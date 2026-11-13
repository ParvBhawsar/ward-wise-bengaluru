"""Aggregate public application counts and detect persistent changes in trade mix."""
import csv
import json
import math
import random
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "dist" / "data"
MIN_HISTORY = 4
MIN_VOLUME = 25
MIN_EXPECTED = 5
Z_LIMIT = 2.0
PSEUDOCOUNT = 40
BUDGET = 3


def load_counts():
    labels = json.loads((DATA / "coverage.json").read_text())["categories"]
    cube = defaultdict(lambda: [[0, 0] for _ in labels])
    with (DATA / "application-counts.csv").open(newline="") as src:
        for row in csv.DictReader(src):
            t = 4 * (int(row["year"]) - 2020) + int(row["quarter"]) - 1
            pair = [int(row["new"]), int(row["renewal"])]
            assert sum(pair) == int(row["total"])
            cube[int(row["ward_id"]), t][labels.index(row["category"])] = pair
    return labels, cube


def predict(past, city_past, city_now, volume, n_past):
    # Shrink the ward's historic category share towards its peers. Apply the
    # contemporary non-target-ward shift on the odds scale to stay within 0..1.
    prior = (city_past[0] + 0.5) / (city_past[1] + 1)
    local = (past + PSEUDOCOUNT * prior) / (n_past + PSEUDOCOUNT)
    current = (city_now[0] + 0.5) / (city_now[1] + 1)
    odds = local / (1 - local) * (current / (1 - current)) / (prior / (1 - prior))
    proportion = odds / (1 + odds)
    mean = volume * proportion
    # Quasi-binomial working dispersion of 2; interval is descriptive.
    sigma = math.sqrt(max(1, 2 * volume * proportion * (1 - proportion) *
                          (1 + volume / (n_past + PSEUDOCOUNT))))
    return mean, sigma


def run():
    labels, cube = load_counts()
    ids = list(range(1, 199))
    periods = range(20)
    totals = {key: sum(sum(p) for p in val) for key, val in cube.items()}
    city = [[sum(sum(cube[w,t][c]) for w in ids) for c in range(len(labels))] for t in periods]
    city_n = [sum(row) for row in city]
    history = {}
    by_t = defaultdict(list)
    for t in range(MIN_HISTORY, 20):
        # Same quarter in all preceding years avoids comparing renewal-season
        # volumes with slower quarters. Current records enter peers only.
        prior_t = list(range(t % 4, t, 4))
        for w in ids:
            n = totals.get((w,t), 0)
            n_past = sum(totals.get((w,q),0) for q in prior_t)
            if min(n, n_past) < MIN_VOLUME:
                continue
            for c in range(8):
                obs = sum(cube[w,t][c])
                past = sum(sum(cube[w,q][c]) for q in prior_t)
                peer_past = (sum(city[q][c] for q in prior_t) - past,
                             sum(city_n[q] for q in prior_t) - n_past)
                peer_now = (city[t][c] - obs, city_n[t] - n)
                mu, sd = predict(past,peer_past,peer_now,n,n_past)
                if mu < MIN_EXPECTED or n-mu < MIN_EXPECTED:
                    continue
                z = (obs-mu)/sd
                record = dict(ward=w, cat=c, t=t, observed=obs, expected=round(mu,1),
                              low=max(0,round(mu-1.96*sd,1)), high=min(n,round(mu+1.96*sd,1)),
                              volume=n, z=round(z,3), sd=sd, cityShare=round(100*peer_now[0]/peer_now[1],2),
                              pastShare=round(100*past/n_past,2))
                history[w,c,t] = record
                prev = history.get((w,c,t-1))
                if prev and abs(z)>=Z_LIMIT and abs(prev['z'])>=Z_LIMIT and prev['z']*z>0:
                    by_t[t].append(record)
    systemic = set()
    for t, rows in by_t.items():
        for c in range(8):
            eligible = sum((w,c,t) in history and (w,c,t-1) in history for w in ids)
            for sign in [-1,1]:
                if eligible and sum(r['cat']==c and r['z']*sign>0 for r in rows) >= max(5,0.25*eligible):
                    systemic.add((t,c,sign))
    def public(r):
        return {k:v for k,v in r.items() if k!='sd'}
    queues = []
    for t in periods:
        candidates=[r for r in by_t[t] if (t,r['cat'],1 if r['z']>0 else -1) not in systemic]
        picked = sorted(candidates,key=lambda r:(-abs(r['z']),r['ward'],r['cat']))[:BUDGET]
        queues.append([public(r) for r in picked])
    # Conditional detector sensitivity, independently simulated on eligible 2024 pairs.
    # This tests the evidence rule before queue truncation, not field validity.
    pairs=[(history[w,c,t-1],r) for (w,c,t),r in history.items() if t>=16 and (w,c,t-1) in history]
    rng=random.Random(7412)
    selected=rng.sample(pairs,min(400,len(pairs)))
    table=[]
    for drop in [0,0.2,0.35,0.5]:
        detected=0
        for a,b in selected:
            zs=[]
            for r in (a,b):
                p=r['expected']/r['volume']*(1-drop)
                # Binomial noise around injected mean; model-based scenario only.
                simulated=sum(rng.random()<p for _ in range(r['volume']))
                zs.append((simulated-r['expected'])/r['sd'])
            detected+=abs(zs[0])>=Z_LIMIT and abs(zs[1])>=Z_LIMIT and zs[0]*zs[1]>0
        table.append(dict(drop=drop,trials=len(selected),detected=detected))
    # Compare budget-matched lists for historical quarters with an eligible next quarter.
    comparison = {}
    for name in ('detector','raw'):
        correct=checked=0
        for t in range(16,19):
            candidates=[r for (w,c,tt),r in history.items() if tt==t]
            if name=='detector':
                rows=queues[t]
            else:
                rows=sorted(candidates,key=lambda r:-abs(r['observed']-sum(cube[r['ward'],t-1][r['cat']])))[:len(queues[t])]
            for r in rows:
                nxt=history.get((r['ward'],r['cat'],t+1))
                if nxt is None:
                    continue
                direction = r['z'] if name=='detector' else r['observed']-sum(cube[r['ward'],t-1][r['cat']])
                checked+=1
                correct+=nxt['z']*direction>0 and abs(nxt['z'])>=Z_LIMIT
        comparison[name]=[correct,checked]
    output=dict(categories=labels, years=list(range(2020,2025)),quarters=20,
                # Sparse integer arrays: ward, quarter index, category, new, renewal.
                rows=[[w,t,c,p[0],p[1]] for (w,t),cs in sorted(cube.items()) for c,p in enumerate(cs) if sum(p)],
                queues=queues, eligible=len(history), evaluation=table,comparison=comparison,
                systemic=sorted(systemic), eligible2024=sum(t>=16 for w,c,t in history))
    (DATA/'atlas.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
    print('Unique applications',sum(city_n),'review cards',sum(map(len,queues)), '2024 tests',table,'comparison',comparison)


if __name__ == '__main__':
    run()
