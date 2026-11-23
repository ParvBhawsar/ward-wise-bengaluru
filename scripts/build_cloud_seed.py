"""Render idempotent PostgreSQL seed files for the public evidence snapshot."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api.evidence import SNAPSHOT, evidence

COUNTS = ('O', 'N', 'H', 'T', 'A', 'B', 'C', 'D')
SCORE = ('expected', 'low', 'high', 'z', 'decision')


def sql_json(value):
    return "'" + json.dumps(value, separators=(',', ':')).replace("'", "''") + "'::jsonb"


def build_seed(destination, wards_per_file=4):
    destination.mkdir(parents=True, exist_ok=True)
    values = []
    for ward in range(1, 199):
        for category in range(8):
            data = evidence(ward, category)
            quarters = []
            for r in data['series'][str(ward)]:
                score = [r['score'][field] for field in SCORE] if r['score'] else None
                quarters.append([*[r[k] for k in COUNTS], score, r['reason']])
            values.append(f"('{SNAPSHOT}',{ward},{category},{sql_json(quarters)},{sql_json(data['parameters'])})")
        if ward % wards_per_file == 0 or ward == 198:
            script = ('INSERT INTO public.ward_evidence_series (snapshot,ward,category,quarters,parameters) VALUES\n'
                      + ',\n'.join(values) + '\nON CONFLICT (snapshot,ward,category) DO NOTHING;\n')
            (destination / f'evidence_through_{ward:03}.sql').write_text(script)
            values.clear()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    build_seed(parser.parse_args().destination)
