"""Exercise the exact Bash step from keep-alive.yml against a local HTTP server."""
import http.server
import os
from pathlib import Path
import socket
import subprocess
import threading
import time
import unittest

workflow = Path('.github/workflows/keep-alive.yml').read_text()
lines = workflow.splitlines()
start = lines.index('        run: |') + 1
script_lines = []
for line in lines[start:]:
    if line.strip() and not line.startswith('          '):
        break
    script_lines.append(line[10:])
SCRIPT = '\n'.join(script_lines) + '\n'
assert SCRIPT.startswith('set -euo pipefail\n')

requests = []

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        requests.append((self.path, self.command, dict(self.headers)))
        if self.path == '/slow':
            time.sleep(20)
        code = {'/ok': 200, '/error': 503, '/redirect': 302, '/slow': 200, '/recover': 200}[self.path]
        if self.path == '/recover' and sum(r[0] == '/recover' for r in requests) <= 2:
            code = 503
        try:
            self.send_response(code)
            if code == 302:
                self.send_header('Location', '/ok')
            self.end_headers()
            self.wfile.write(b'body-must-not-appear-in-logs')
        except (BrokenPipeError, ConnectionResetError):
            pass

class KeepAliveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def run_ping(self, url):
        started = time.monotonic()
        result = subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', SCRIPT],
            env={**os.environ, 'HEALTH_URL': url, 'NO_PROXY': '127.0.0.1'},
            capture_output=True, text=True, timeout=90)
        elapsed = time.monotonic() - started
        # Escape annotations from intentionally failing scenarios in the parent CI log.
        print(f'\n{self.id().split(".")[-1]}: exit={result.returncode}, duration={elapsed:.2f}s', flush=True)
        for line in (result.stdout + result.stderr).splitlines():
            print('  | ' + line, flush=True)
        return result, elapsed

    def test_200_get_headers_and_no_body(self):
        result, _ = self.run_ping(self.base + '/ok')
        self.assertEqual(result.returncode, 0)
        self.assertIn('HTTP status: 200', result.stdout)
        self.assertNotIn('body-must-not-appear-in-logs', result.stdout)
        path, method, headers = requests[-1]
        self.assertEqual((path, method), ('/ok', 'GET'))
        self.assertEqual(headers['Cache-Control'], 'no-cache')
        self.assertEqual(headers['Pragma'], 'no-cache')

    def test_503_fails_and_logs_status(self):
        result, _ = self.run_ping(self.base + '/error')
        self.assertEqual(result.returncode, 1)
        self.assertIn('HTTP status: 503', result.stdout)

    def test_redirect_is_not_mistaken_for_success(self):
        count = len(requests)
        result, _ = self.run_ping(self.base + '/redirect')
        self.assertEqual(result.returncode, 1)
        self.assertIn('HTTP status: 302', result.stdout)
        self.assertEqual(len(requests), count + 1)

    def test_connection_refused(self):
        with socket.socket() as closed_port:
            closed_port.bind(('127.0.0.1', 0))
            port = closed_port.getsockname()[1]
        result, _ = self.run_ping(f'http://127.0.0.1:{port}/')
        self.assertEqual(result.returncode, 7)
        self.assertIn('HTTP status: 000', result.stdout)

    def test_timeout_15_seconds(self):
        result, elapsed = self.run_ping(self.base + '/slow')
        self.assertEqual(result.returncode, 28)
        self.assertIn('HTTP status: 000', result.stdout)
        self.assertEqual(result.stdout.count('HTTP status: 000'), 4)
        self.assertGreaterEqual(elapsed, 74)
        self.assertLess(elapsed, 85)

    def test_recovers_after_transient_failure(self):
        result, _ = self.run_ping(self.base + '/recover')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.count('HTTP status: 503'), 2)
        self.assertIn('HTTP status: 200', result.stdout)
        self.assertIn('Attempt 3/4', result.stdout)

if __name__ == '__main__':
    unittest.main(verbosity=2)
