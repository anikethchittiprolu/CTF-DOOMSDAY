"""ctfd-doom: round gating, the Incursion clock, broadcasts, codex and handler messages.

CTFd stays authoritative for users, teams, flags, hints, attempts and scoring.
"""
import json
import os

from .adapter import CTFdAdapter
from .content import Content
from .service import DoomService
from .store import SqlStore


def load(app):
    from flask import request, send_file
    from .api import build_blueprint
    from .gating import install
    from .models import db

    dev = os.environ.get("DOOM_DEV", "") == "1"

    def query_clock():
        v = request.args.get("clock") if dev else None
        try:
            return None if v is None else float(v)
        except ValueError:
            return None

    app.db.create_all()
    svc = DoomService(CTFdAdapter(), SqlStore(), Content(), dev=dev, query_clock=query_clock)
    app.doom = svc
    app.register_blueprint(build_blueprint(svc))
    install(app, svc)

    sw = os.environ.get("DOOM_SW_PATH") or os.path.join(app.root_path, "themes", "doomsday",
                                                         "static", "sw.js")

    @app.route("/doom-sw.js")
    def doom_sw():
        # Served from the site root so the service worker can control the whole origin.
        if not os.path.isfile(sw):
            return ("", 404)
        resp = send_file(sw, mimetype="text/javascript")
        resp.headers["Service-Worker-Allowed"] = "/"
        resp.headers["Cache-Control"] = "no-cache"
        return resp

    try:
        from CTFd.plugins import register_admin_plugin_menu_bar
        register_admin_plugin_menu_bar("Doom Rounds", "/admin/doom")
    except Exception:
        pass
