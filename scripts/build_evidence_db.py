"""Build the immutable public evidence database from the published research release."""
import json
import os
import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist' / 'data'
DATABASE = ROOT / 'server' / 'evidence.sqlite3'


def build(destination=DATABASE):
    atlas = json.loads((DATA / 'atlas.json').read_bytes())
    audit = json.loads((DATA / 'audit.json').read_bytes())
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=destination.parent)
    os.close(fd)
    try:
        connection = sqlite3.connect(name)
        try:
            connection.executescript("""
                CREATE TABLE filing (ward INTEGER, t INTEGER, cat INTEGER, total INTEGER NOT NULL,
                    PRIMARY KEY (ward, t, cat)) WITHOUT ROWID;
                CREATE TABLE score (ward INTEGER, cat INTEGER, t INTEGER, expected REAL, low REAL,
                    high REAL, z REAL, decision TEXT, PRIMARY KEY (ward, cat, t)) WITHOUT ROWID;
                CREATE TABLE parameters (json TEXT NOT NULL);
                CREATE TABLE period(t INTEGER PRIMARY KEY);
            """)
            with connection:
                connection.executemany('INSERT INTO filing VALUES (?,?,?,?)',
                    ((w, t, c, fresh + renewal) for w, t, c, fresh, renewal in atlas['rows']))
                connection.executemany('INSERT INTO score VALUES (?,?,?,?,?,?,?,?)', sorted(audit['scores']))
                connection.execute('INSERT INTO parameters VALUES (?)', (json.dumps(audit['parameters']),))
                connection.executemany('INSERT INTO period VALUES (?)', ((t,) for t in range(atlas['quarters'])))
                connection.execute('CREATE TABLE ward_total AS SELECT ward,t,SUM(total) AS n FROM filing GROUP BY ward,t')
                connection.execute('CREATE UNIQUE INDEX ward_period ON ward_total(ward,t)')
                connection.execute('CREATE TABLE city_trade AS SELECT t,cat,SUM(total) AS n FROM filing GROUP BY t,cat')
                connection.execute('CREATE UNIQUE INDEX city_period_trade ON city_trade(t,cat)')
                connection.execute('CREATE TABLE city_total AS SELECT t,SUM(n) AS n FROM ward_total GROUP BY t')
                connection.execute('CREATE UNIQUE INDEX city_period ON city_total(t)')
            if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('The evidence database failed its integrity check.')
        finally:
            connection.close()
        os.chmod(name, 0o644)
        os.replace(name, destination)
    finally:
        Path(name).unlink(missing_ok=True)


if __name__ == '__main__':
    build()
