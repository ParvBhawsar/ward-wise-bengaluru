"""Public, read-only ward evidence API. Each reply covers a single trade over 20 quarters."""
import json
import os
import sqlite3
from contextlib import closing
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.error import URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

DATABASE = Path(__file__).resolve().parents[1] / 'server' / 'evidence.sqlite3'
SNAPSHOT = '109bcef90a1d2187'
QUERY = """
    SELECT p.t, COALESCE(f.total,0), COALESCE(w.n,0), COALESCE(c.n,0), ct.n,
           s.expected,s.low,s.high,s.z,s.decision
    FROM period p JOIN city_total ct ON ct.t=p.t
    LEFT JOIN filing f ON f.ward=:ward AND f.t=p.t AND f.cat=:category
    LEFT JOIN ward_total w ON w.ward=:ward AND w.t=p.t
    LEFT JOIN city_trade c ON c.t=p.t AND c.cat=:category
    LEFT JOIN score s ON s.ward=:ward AND s.cat=:category AND s.t=p.t
    ORDER BY p.t
"""


def query_args(query):
    args = parse_qs(query, keep_blank_values=True, strict_parsing=True, max_num_fields=8)
    for internal in ('x-vercel-protection-bypass', 'x-vercel-set-bypass-cookie'):
        args.pop(internal, None)
    limits = {'ward': (1, 198), 'category': (0, 7), 'peer': (1, 198)}
    if set(args) - limits.keys() or not {'ward', 'category'} <= args.keys():
        raise ValueError('Specify ward (1–198), category (0–7) and optionally peer (1–198).')
    result = {}
    for k, values in args.items():
        value = values[0]
        lo, hi = limits[k]
        if len(values) != 1 or not value.isascii() or not value.isdecimal() or len(value) > 3 or not lo <= int(value) <= hi:
            raise ValueError(f'{k} must be one integer between {lo} and {hi}.')
        result[k] = int(value)
    return result


def evidence(ward, category, peer=None, database=DATABASE):
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro&immutable=1', uri=True)) as cn:
        parameters = json.loads(cn.execute('SELECT json FROM parameters').fetchone()[0])
        series = {}
        for w in dict.fromkeys([ward] + ([peer] if peer is not None else [])):
            seasons = [[0, 0, 0, 0] for _ in range(4)]
            records = []
            for t, o, n, city_trade, city_all, expected, low, high, z, decision in cn.execute(QUERY, {'ward': w, 'category': category}):
                h, total, a, b = seasons[t % 4]
                c, d = city_trade-o, city_all-n
                score = dict(expected=expected, low=low, high=high, z=z, decision=decision) if decision else None
                reason = ('baseline' if t < 4 else 'volume' if min(n, total) < parameters['volume'] else decision or 'small')
                records.append(dict(ward=w, cat=category, t=t, O=o, N=n, H=h, T=total, A=a, B=b, C=c, D=d,
                                    score=score, prev=records[-1]['score'] if records else None, reason=reason))
                seasons[t % 4] = [h+o, total+n, a+c, b+d]
            series[str(w)] = records
        return dict(version=1, parameters=parameters, series=series)


def managed_evidence(ward, category, peer, url, key):
    wards = list(dict.fromkeys([ward] + ([peer] if peer is not None else [])))
    params = urlencode({'select':'ward,quarters,parameters', 'snapshot':'eq.' + SNAPSHOT,
                        'category':f'eq.{category}', 'ward':'in.(' + ','.join(map(str, wards)) + ')'})
    request = Request(url.rstrip('/') + '/rest/v1/ward_evidence_series?' + params,
                      headers={'apikey':key, 'Accept':'application/json'})
    with urlopen(request, timeout=2.5) as response:
        data = json.load(response)
    series = {}
    parameters = None
    for row in data:
        w = row['ward']
        if w not in wards or len(row['quarters']) != 20:
            raise ValueError('Incomplete managed evidence series')
        records = []
        parameters = row['parameters']
        for t, packed in enumerate(row['quarters']):
            o,n,h,total,a,b,c,d,packed_score,reason = packed
            score = dict(zip(('expected','low','high','z','decision'), packed_score, strict=True)) if packed_score else None
            records.append(dict(ward=w,cat=category,t=t,O=o,N=n,H=h,T=total,A=a,B=b,C=c,D=d,
                                score=score,prev=records[-1]['score'] if records else None,reason=reason))
        series[str(w)] = records
    if set(series) != {str(w) for w in wards} or not isinstance(parameters, dict):
        raise ValueError('Managed snapshot is incomplete')
    return dict(version=1, parameters=parameters, series=series)


def read_evidence(ward, category, peer=None):
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY')
    if url and key:
        try:
            return managed_evidence(ward,category,peer,url,key), 'supabase'
        except (OSError, URLError, ValueError, KeyError, TypeError):
            # The identical database travels with each release for failover.
            return evidence(ward,category,peer), 'sqlite-fallback'
    return evidence(ward,category,peer), 'sqlite'


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            args = query_args(urlsplit(self.path).query)
        except ValueError as exc:
            return self.reply(400, {'error': str(exc)})
        try:
            body, source = read_evidence(**args)
            self.reply(200, body, source)
        except (sqlite3.Error, OSError):
            self.log_error('Evidence database unavailable')
            self.reply(503, {'error': 'Evidence temporarily unavailable. Please retry.'})

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        self.reply(405, {'error': 'Use GET or HEAD.'})

    def reply(self, status, body, source=None):
        data = json.dumps(body, separators=(',', ':'), allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        if source:
            self.send_header('X-Evidence-Source', source)
            self.send_header('X-Evidence-Snapshot', SNAPSHOT)
        cache = 'public, max-age=60, s-maxage=86400' if status == 200 else 'no-store'
        if source == 'sqlite-fallback':
            cache = 'public, max-age=0, s-maxage=15'
        self.send_header('Cache-Control', cache)
        if status == 405:
            self.send_header('Allow', 'GET, HEAD')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)
