from datetime import datetime, timezone

try:  # inside CTFd
    from CTFd.models import db
except ImportError:  # standalone tests
    from flask_sqlalchemy import SQLAlchemy
    db = SQLAlchemy()


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DoomRound(db.Model):
    __tablename__ = "doom_round"
    n = db.Column(db.Integer, primary_key=True, autoincrement=False)
    name = db.Column(db.String(128), nullable=False)
    opens_at = db.Column(db.DateTime, nullable=False)  # naive UTC
    status = db.Column(db.String(16), nullable=False, default="scheduled")
    kind = db.Column(db.String(16), nullable=False, default="normal")


class DoomChallengePhase(db.Model):
    __tablename__ = "doom_challenge_phase"
    challenge_id = db.Column(db.Integer, primary_key=True, autoincrement=False)
    round_n = db.Column(db.Integer, nullable=False, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)


class DoomSetting(db.Model):
    __tablename__ = "doom_setting"
    key = db.Column(db.String(64), primary_key=True)
    value = db.Column(db.Text, nullable=True)


class DoomBroadcastSnapshot(db.Model):
    __tablename__ = "doom_broadcast_snapshot"
    id = db.Column(db.Integer, primary_key=True)
    broadcast_key = db.Column(db.String(32), unique=True, nullable=False)
    rendered_text = db.Column(db.Text, nullable=False)
    rendered_subtitle = db.Column(db.Text, nullable=False)
    rendered_at = db.Column(db.DateTime, nullable=False, default=_now)


class DoomMessageRead(db.Model):
    __tablename__ = "doom_message_read"
    team_id = db.Column(db.Integer, primary_key=True, autoincrement=False)
    message_id = db.Column(db.String(64), primary_key=True)
    read_at = db.Column(db.DateTime, nullable=False, default=_now)


class DoomAudit(db.Model):
    __tablename__ = "doom_audit"
    id = db.Column(db.Integer, primary_key=True)
    at = db.Column(db.DateTime, nullable=False, default=_now)
    actor = db.Column(db.String(128), nullable=False, default="")
    action = db.Column(db.String(64), nullable=False)
    detail = db.Column(db.Text, nullable=False, default="")
