"""Runs seed_ctfd.py against a tiny fake CTFd and checks what it sends."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import seed_ctfd


class Fake(BaseHTTPRequestHandler):
    log = []
    chals = []

    def _send(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        assert self.headers["Authorization"] == "Token tkn"
        self._send({"success": True, "data": list(Fake.chals)})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Fake.log.append((self.path, body))
        if self.path == "/api/v1/challenges":
            c = {"id": len(Fake.chals) + 1, "name": body["name"]}
            Fake.chals.append(c)
            return self._send({"success": True, "data": c})
        self._send({"success": True, "data": {"id": 1}})

    def log_message(self, *a):
        pass


def run(args):
    Fake.log, Fake.chals = [], []
    srv = HTTPServer(("127.0.0.1", 0), Fake)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        rc = seed_ctfd.main(["--url", "http://127.0.0.1:%d" % srv.server_port, "--token", "tkn"] + args)
    finally:
        srv.shutdown()
    return rc


def count(path):
    return sum(1 for p, _ in Fake.log if p == path)


def test_default_seed_is_54_challenges_with_two_hints_and_5_attempts():
    assert run([]) == 0
    assert count("/api/v1/challenges") == 54
    assert count("/api/v1/flags") == 54 and count("/api/v1/hints") == 108
    creates = [b for p, b in Fake.log if p == "/api/v1/challenges"]
    assert all(b["max_attempts"] == 5 and b["type"] == "standard" for b in creates)
    flags = [b for p, b in Fake.log if p == "/api/v1/flags"]
    assert {f["content"] for f in flags} == {"MVSR{demo}"}
    assert count("/api/doom/v1/admin/seed") == 1
    assert len({b["category"] for b in creates}) == 10


def test_bonus_flag_adds_six():
    run(["--bonus"])
    assert count("/api/v1/challenges") == 60


def test_generic_shape_10_rounds_of_12():
    assert run(["--rounds", "10", "--per-round", "12"]) == 0
    assert count("/api/v1/challenges") == 120
    sets = [b for p, b in Fake.log if p == "/api/doom/v1/admin/rounds"]
    assert sets == [{"action": "set_count", "count": 10}]
    asg = [b for p, b in Fake.log if p == "/api/doom/v1/admin/assignments"][0]["assignments"]
    assert len(asg) == 120 and {a["round_n"] for a in asg} == set(range(1, 11))
    first = {c["category"] for c in [b for p, b in Fake.log if p == "/api/v1/challenges"][:12]}
    assert len(first) == 10, "round 1 touches every category"


def test_is_idempotent():
    run([])
    Fake.log = []
    srv_chals = list(Fake.chals)
    srv = HTTPServer(("127.0.0.1", 0), Fake)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        seed_ctfd.main(["--url", "http://127.0.0.1:%d" % srv.server_port, "--token", "tkn", "--no-assign"])
    finally:
        srv.shutdown()
    assert count("/api/v1/challenges") == 0
