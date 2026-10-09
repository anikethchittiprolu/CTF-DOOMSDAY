"""Server-side gating. Locked challenges cannot be read or attacked by calling the API."""
import json
import re

from flask import jsonify, request

LOCKED_PATH = re.compile(r"^/api/v1/challenges/(\d+)(/.*)?$")
HINT_PATH = re.compile(r"^/api/v1/hints/(\d+)$")


def install(app, svc):
    def locked_response(until, reason):
        body = {"success": False, "locked_until": until,
                "errors": {"challenge": "This challenge is not open yet." if reason != "unassigned"
                           else "This challenge is not available."}}
        return jsonify(body), 403

    def is_admin():
        me = svc.adapter.current()
        return bool(me and me["is_admin"])

    def check(cid):
        allowed, until, reason = svc.gate(cid, is_admin())
        return None if allowed else locked_response(until, reason)

    @app.before_request
    def doom_gate():
        path = request.path
        if not path.startswith("/api/v1/"):
            return None
        if path == "/api/v1/challenges/attempt":
            if request.method != "POST":
                return None
            data = request.get_json(silent=True) or request.form
            try:
                cid = int(data.get("challenge_id"))
            except (TypeError, ValueError):
                return None
            return check(cid)
        m = LOCKED_PATH.match(path)
        if m:
            return check(int(m.group(1)))
        m = HINT_PATH.match(path)
        if m:
            cid = svc.adapter.hint_challenge(int(m.group(1)))
            return None if cid is None else check(cid)
        if path == "/api/v1/unlocks" and request.method == "POST":
            data = request.get_json(silent=True) or {}
            if data.get("type") == "hints":
                try:
                    cid = svc.adapter.hint_challenge(int(data.get("target")))
                except (TypeError, ValueError):
                    return None
                return None if cid is None else check(cid)
        return None

    @app.after_request
    def doom_filter(resp):
        if request.path != "/api/v1/challenges" or request.method != "GET":
            return resp
        if resp.status_code != 200 or not (resp.mimetype or "").endswith("json"):
            return resp
        visible = svc.visible_ids(is_admin())
        if visible is None:
            return resp
        try:
            body = json.loads(resp.get_data(as_text=True))
        except ValueError:
            return resp
        if isinstance(body.get("data"), list):
            body["data"] = [c for c in body["data"] if c.get("id") in visible]
            resp.set_data(json.dumps(body))
        return resp
