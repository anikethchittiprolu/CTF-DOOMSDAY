from datetime import timedelta

import pytest
from flask import Flask, jsonify, request

from ctfd_doom.api import build_blueprint
from ctfd_doom.content import Content
from ctfd_doom.gating import install
from ctfd_doom.models import db
from ctfd_doom.service import DoomService
from ctfd_doom.store import SqlStore

from .fakes import START, FakeAdapter


class Clock:
    """Real time as the service sees it. Tests move it to step through the event."""

    def __init__(self):
        self.t = START

    def __call__(self):
        return self.t

    def at_hour(self, h):
        self.t = START + timedelta(hours=h)


@pytest.fixture(scope="session")
def content():
    return Content()


@pytest.fixture
def env(content):
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI="sqlite://", TESTING=True)
    db.init_app(app)
    clock = Clock()
    adapter = FakeAdapter(content)
    with app.app_context():
        db.create_all()
        svc = DoomService(adapter, SqlStore(), content, state_ttl=0, stats_ttl=0, real_now=clock)
        app.register_blueprint(build_blueprint(svc))
        install(app, svc)

        # Stand-ins for CTFd's own challenge routes, so gating can be exercised.
        @app.route("/api/v1/challenges")
        def list_challenges():
            return jsonify({"success": True, "data": [{"id": c["id"], "name": c["name"]}
                                                       for c in adapter.chals]})

        @app.route("/api/v1/challenges/<int:cid>")
        def one(cid):
            return jsonify({"success": True, "data": {"id": cid}})

        @app.route("/api/v1/challenges/attempt", methods=["POST"])
        def attempt():
            return jsonify({"success": True, "data": {"status": "correct"}})

        @app.route("/api/v1/hints/<int:hid>")
        def hint(hid):
            return jsonify({"success": True, "data": {"id": hid}})

        @app.route("/api/v1/challenges/<int:cid>/solves")
        def solves(cid):
            return jsonify({"success": True, "data": []})

        class E:
            pass
        e = E()
        e.app, e.svc, e.clock, e.adapter, e.client = app, svc, clock, adapter, app.test_client()
        svc.seed_from_content("test")
        yield e
