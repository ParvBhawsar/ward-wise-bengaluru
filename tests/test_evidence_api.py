import json
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path

from api.evidence import DATABASE, evidence, query_args

DATA = Path(__file__).resolve().parents[1] / 'dist' / 'data'


class PublicEvidenceTests(unittest.TestCase):
    def test_database_matches_the_published_research_inputs(self):
        atlas = json.loads((DATA / 'atlas.json').read_bytes())
        audit = json.loads((DATA / 'audit.json').read_bytes())
        with closing(sqlite3.connect(DATABASE.as_uri() + '?mode=ro', uri=True)) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone(), ('ok',))
            self.assertEqual(sorted(db.execute('SELECT * FROM filing')),
                             sorted((w,t,c,f+r) for w,t,c,f,r in atlas['rows']))
            self.assertEqual(sorted(db.execute('SELECT * FROM score')), sorted(map(tuple, audit['scores'])))
            self.assertEqual(json.loads(db.execute('SELECT json FROM parameters').fetchone()[0]), audit['parameters'])
            for table, columns in [('ward_total','ward,t'), ('city_trade','t,cat'), ('city_total','t')]:
                self.assertEqual(sorted(db.execute(f'SELECT * FROM {table}')),
                                 sorted(db.execute(f'SELECT {columns}, SUM(total) FROM filing GROUP BY {columns}')))
            self.assertEqual(db.execute('SELECT SUM(n) FROM city_total').fetchone(), (345123,))

    def test_public_comparison_and_prior_quarters(self):
        report = evidence(**query_args('ward=85&category=1&peer=150'))
        self.assertEqual(report['version'], 1)
        self.assertEqual(set(report['series']), {'85','150'})
        points = report['series']['85']
        self.assertEqual([p['t'] for p in points], list(range(20)))
        self.assertEqual(points[0]['reason'], 'baseline')
        self.assertIsNone(points[0]['score'])
        self.assertEqual(points[18]['reason'], 'unconfirmed')
        self.assertEqual(points[19]['prev'], points[18]['score'])
        self.assertEqual((points[19]['O'], points[19]['score']['expected'], points[19]['reason']), (36, 92.4, 'selected'))
        self.assertEqual(report['series']['150'], evidence(150, 1)['series']['150'])

    def test_rejects_invalid_or_ambiguous_requests(self):
        for query in ('','ward=1','ward=0&category=0','ward=1&category=8','ward=1&category=0&peer=',
                      'ward=1&ward=2&category=1','ward=1&category=1&extra=2','ward=12.5&category=1'):
            with self.subTest(query=query), self.assertRaises(ValueError):
                query_args(query)
