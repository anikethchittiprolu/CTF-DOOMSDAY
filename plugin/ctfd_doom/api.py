from flask import Blueprint, jsonify, render_template, request


def build_blueprint(svc):
    bp = Blueprint("doom", __name__, template_folder="templates")

    def who():
        return svc.adapter.current()

    def auth(admin=False):
        me = who()
        if me is None:
            return None, (jsonify({"success": False, "errors": {"auth": "login required"}}), 403)
        if admin and not me["is_admin"]:
            return None, (jsonify({"success": False, "errors": {"auth": "admin only"}}), 403)
        return me, None

    def ok(**kw):
        return jsonify(dict(success=True, **kw))

    @bp.route("/api/doom/v1/state")
    def state():
        me, err = auth()
        return err or jsonify(svc.state(me["account_id"]))

    @bp.route("/api/doom/v1/broadcasts")
    def broadcasts():
        me, err = auth()
        return err or ok(data=svc.broadcasts())

    @bp.route("/api/doom/v1/codex")
    def codex():
        me, err = auth()
        return err or ok(data=svc.codex(me["account_id"]))

    @bp.route("/api/doom/v1/messages")
    def messages():
        me, err = auth()
        return err or ok(data=svc.messages(me["account_id"]))

    @bp.route("/api/doom/v1/messages/<mid>/read", methods=["POST"])
    def read(mid):
        me, err = auth()
        if err:
            return err
        return ok() if svc.mark_read(me["account_id"], mid) else (jsonify({"success": False}), 404)

    @bp.route("/api/doom/v1/stats")
    def stats():
        me, err = auth()
        return err or ok(data=svc.stats())

    def admin_call(fn):
        me, err = auth(admin=True)
        if err:
            return err
        try:
            return ok(data=fn(me))
        except (ValueError, KeyError, TypeError) as e:
            return jsonify({"success": False, "errors": {"input": str(e)}}), 400

    @bp.route("/api/doom/v1/admin/board")
    def board():
        return admin_call(lambda me: svc.board())

    @bp.route("/api/doom/v1/admin/clock", methods=["POST"])
    def clock_():
        return admin_call(lambda me: svc.clock_action(request.get_json(force=True), me["name"]))

    @bp.route("/api/doom/v1/admin/rounds", methods=["POST"])
    def rounds():
        return admin_call(lambda me: svc.rounds_action(request.get_json(force=True), me["name"]))

    @bp.route("/api/doom/v1/admin/assignments", methods=["POST"])
    def assignments():
        return admin_call(lambda me: svc.assign(request.get_json(force=True)["assignments"], me["name"]))

    @bp.route("/api/doom/v1/admin/seed", methods=["POST"])
    def seed():
        return admin_call(lambda me: svc.seed_from_content(me["name"]))

    @bp.route("/admin/doom")
    def console():
        me, err = auth(admin=True)
        if err:
            return err
        return render_template("doom_admin.html")

    return bp
