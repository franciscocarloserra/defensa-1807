#!/usr/bin/env python3
"""Dev server (python3 tools/serve.py 7807): static files + POST /log -> LOG (frontend telemetry). Binds 0.0.0.0 for phone QA on the LAN."""
import http.server, json, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7807
LOG = '/tmp/defensa1807-console.jsonl'


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/assets-list':
            files = sorted(f for f in os.listdir('assets') if f.lower().endswith('.glb'))
            body = json.dumps(files).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            return self.wfile.write(body)
        super().do_GET()

    def send_head(self):  # GET y HEAD: nunca servir .env / .git
        if any(p.startswith('.') for p in self.path.split('?')[0].split('/') if p):
            return self.send_error(404)
        return super().send_head()

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


os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # serve the project root
http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
