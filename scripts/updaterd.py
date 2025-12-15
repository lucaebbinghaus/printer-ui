#!/usr/bin/env python3
import os
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = os.environ.get("UPDATER_HOST", "127.0.0.1")
PORT = int(os.environ.get("UPDATER_PORT", "9123"))
TOKEN = os.environ.get("UPDATER_TOKEN", "")

def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return p.returncode, p.stdout

class Handler(BaseHTTPRequestHandler):
    def _auth_ok(self):
        if not TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {TOKEN}"

    def _json(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if not self._auth_ok():
            return self._json(401, {"ok": False, "error": "unauthorized"})

        if self.path == "/run":
            rc, out = run(["/bin/systemctl", "start", "printer-ui-update.service"])
            return self._json(200 if rc == 0 else 500, {"ok": rc == 0, "output": out})

        return self._json(404, {"ok": False, "error": "not found"})

    def do_GET(self):
        if not self._auth_ok():
            return self._json(401, {"ok": False, "error": "unauthorized"})

        if self.path == "/status":
            rc1, show = run([
                "/bin/systemctl", "show", "printer-ui-update.service",
                "-p", "ActiveState", "-p", "SubState", "-p", "Result",
                "-p", "ExecMainStatus", "-p", "ExecMainStartTimestamp", "-p", "ExecMainExitTimestamp"
            ])
            rc2, log = run(["/bin/journalctl", "-u", "printer-ui-update.service", "-n", "200", "--no-pager"])
            ok = (rc1 == 0 and rc2 == 0)
            return self._json(200 if ok else 500, {"ok": ok, "state": show, "log": log})

        return self._json(404, {"ok": False, "error": "not found"})

if __name__ == "__main__":
    httpd = HTTPServer((HOST, PORT), Handler)
    print(f"Updater listening on http://{HOST}:{PORT}")
    httpd.serve_forever()
