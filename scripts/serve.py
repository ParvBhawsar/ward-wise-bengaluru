"""Serve the public site and its evidence API locally, without third-party dependencies."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from api.evidence import handler as EvidenceHandler


class LocalHandler(SimpleHTTPRequestHandler):
    reply = EvidenceHandler.reply

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path == '/api/evidence':
            return EvidenceHandler.do_GET(self)
        return super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path == '/api/evidence':
            return EvidenceHandler.do_POST(self)
        return self.send_error(405)

    def do_HEAD(self):
        if urlsplit(self.path).path == '/api/evidence':
            return EvidenceHandler.do_GET(self)
        return super().do_HEAD()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'Ward Wise: http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), LocalHandler).serve_forever()
