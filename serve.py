#!/usr/bin/env python3
"""Dev server: static files + POST /log -> LOG (frontend telemetry). Binds 0.0.0.0 for phone QA on the LAN."""
import http.server, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7807
LOG = '/tmp/defensa1807-console.jsonl'


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/log':
            return self.send_error(404)
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        with open(LOG, 'ab') as f:
            f.write(body + b'\n')
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
