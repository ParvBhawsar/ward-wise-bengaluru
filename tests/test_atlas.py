import hashlib
import json
import sys
import unittest
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from build_analysis import predict


class AtlasChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        folder=ROOT/'dist'/'data'
        cls.atlas=json.loads((folder/'atlas.json').read_text())
        cls.wards=json.loads((folder/'wards.json').read_text())['wards']
        cls.coverage=json.loads((folder/'coverage.json').read_text())

    def test_source_aggregate_digest(self):
        data=(ROOT/'dist/data/application-counts.csv').read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(),'49430ace59b9b991f2b1a1fa1b24f8968f67a9d3bf33815b3e00ae1544b2908c')

    def test_annual_and_type_totals(self):
        year=Counter()
        for w,t,c,n,r in self.atlas['rows']:
            year[str(2020+t//4)] += n+r
            self.assertTrue(n>=0 and r>=0 and 0<=t<20)
        self.assertEqual(dict(year), self.coverage['calendar_year_totals'])
        self.assertEqual(sum(row[3] for row in self.atlas['rows']),60856)
        self.assertEqual(sum(row[4] for row in self.atlas['rows']),284267)

    def test_map_alignment(self):
        ids={w['id'] for w in self.wards}
        self.assertEqual(ids,set(range(1,199)))
        self.assertEqual(ids,{r[0] for r in self.atlas['rows']})
        for w in self.wards:
            self.assertTrue(w['path'].startswith('M') and len(w['name'])>1)

    def test_cells_unique(self):
        rows=self.atlas['rows']
        self.assertEqual(len(rows),len({tuple(r[:3]) for r in rows}))

    def test_case_budget_and_band(self):
        for t,queue in enumerate(self.atlas['queues']):
            self.assertLessEqual(len(queue),3)
            for r in queue:
                self.assertEqual(r['t'],t)
                self.assertGreaterEqual(r['volume'],25)
                self.assertTrue(r['observed']<r['low'] or r['observed']>r['high'])
                self.assertLess(r['cat'],8)

    def test_shared_change_adjustment(self):
        base,sd=predict(20,(200,1000),(200,1000),100,100)
        shifted,_=predict(20,(200,1000),(400,1000),100,100)
        self.assertAlmostEqual(base,20,delta=.2)
        self.assertAlmostEqual(shifted,40,delta=.2)
        self.assertGreater(sd,0)

    def test_holdout_results(self):
        self.assertEqual(self.atlas['evaluation'][0]['drop'],0)
        self.assertTrue(all(v['trials']==400 for v in self.atlas['evaluation']))
        self.assertEqual(self.atlas['queues'][19][0]['observed'],36)
        self.assertEqual(self.atlas['queues'][19][0]['ward'],85)

if __name__=='__main__':
    unittest.main()
