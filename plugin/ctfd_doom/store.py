"""All database access for the plugin lives here."""
import json
from datetime import timezone

from .clock import as_utc
from .models import (DoomAudit, DoomBroadcastSnapshot, DoomChallengePhase,
                     DoomMessageRead, DoomRound, DoomSetting, db)
from .rounds import Round


def _naive(dt):
    return as_utc(dt).replace(tzinfo=None)


def _aware(dt):
    return dt.replace(tzinfo=timezone.utc)


class SqlStore:
    # settings -----------------------------------------------------------
    def get_setting(self, key, default=None):
        row = db.session.get(DoomSetting, key)
        return default if row is None or row.value is None else row.value

    def set_setting(self, key, value):
        row = db.session.get(DoomSetting, key)
        if row is None:
            row = DoomSetting(key=key)
            db.session.add(row)
        row.value = None if value is None else str(value)
        db.session.commit()

    # rounds -------------------------------------------------------------
    def rounds(self):
        rows = DoomRound.query.order_by(DoomRound.n).all()
        return [Round(r.n, r.name, _aware(r.opens_at), r.status, r.kind) for r in rows]

    def replace_rounds(self, rounds):
        DoomRound.query.delete()
        for r in rounds:
            db.session.add(DoomRound(n=r.n, name=r.name, opens_at=_naive(r.opens_at),
                                     status=r.status, kind=r.kind))
        db.session.commit()

    def upsert_round(self, r):
        row = db.session.get(DoomRound, r.n)
        if row is None:
            row = DoomRound(n=r.n)
            db.session.add(row)
        row.name, row.opens_at, row.status, row.kind = r.name, _naive(r.opens_at), r.status, r.kind
        db.session.commit()

    def delete_round(self, n):
        DoomRound.query.filter_by(n=n).delete()
        DoomChallengePhase.query.filter_by(round_n=n).delete()
        db.session.commit()

    # assignments --------------------------------------------------------
    def assignments(self):
        return {a.challenge_id: a.round_n for a in DoomChallengePhase.query.all()}

    def assignment_rows(self):
        return [(a.challenge_id, a.round_n, a.sort_order)
                for a in DoomChallengePhase.query.order_by(DoomChallengePhase.round_n,
                                                           DoomChallengePhase.sort_order).all()]

    def set_assignments(self, items):
        """items: list of (challenge_id, round_n or None, sort_order)."""
        for cid, n, order in items:
            row = db.session.get(DoomChallengePhase, cid)
            if n is None:
                if row is not None:
                    db.session.delete(row)
                continue
            if row is None:
                row = DoomChallengePhase(challenge_id=cid)
                db.session.add(row)
            row.round_n, row.sort_order = n, order
        db.session.commit()

    def move_round_assignments(self, mapping):
        """mapping {old_n: new_n or None}. Used when the round count changes."""
        for row in DoomChallengePhase.query.all():
            if row.round_n in mapping:
                new = mapping[row.round_n]
                if new is None:
                    db.session.delete(row)
                else:
                    row.round_n = new
        db.session.commit()

    # broadcasts ---------------------------------------------------------
    def snapshot(self, key):
        row = DoomBroadcastSnapshot.query.filter_by(broadcast_key=key).first()
        return None if row is None else (row.rendered_text, row.rendered_subtitle, _aware(row.rendered_at))

    def save_snapshot(self, key, text, subtitle, when):
        row = DoomBroadcastSnapshot(broadcast_key=key, rendered_text=text,
                                    rendered_subtitle=subtitle, rendered_at=_naive(when))
        db.session.add(row)
        try:
            db.session.commit()
        except Exception:  # two workers raced; the first writer wins
            db.session.rollback()
        return self.snapshot(key)

    # messages -----------------------------------------------------------
    def read_ids(self, team_id):
        return {r.message_id for r in DoomMessageRead.query.filter_by(team_id=team_id).all()}

    def mark_read(self, team_id, message_id, when):
        if db.session.get(DoomMessageRead, (team_id, message_id)) is None:
            db.session.add(DoomMessageRead(team_id=team_id, message_id=message_id,
                                           read_at=_naive(when)))
            db.session.commit()

    # audit --------------------------------------------------------------
    def audit(self, actor, action, detail, when):
        db.session.add(DoomAudit(actor=actor, action=action,
                                 detail=detail if isinstance(detail, str) else json.dumps(detail),
                                 at=_naive(when)))
        db.session.commit()

    def audit_tail(self, limit=50):
        rows = DoomAudit.query.order_by(DoomAudit.id.desc()).limit(limit).all()
        return [{"at": _aware(r.at).isoformat(), "actor": r.actor, "action": r.action,
                 "detail": r.detail} for r in rows]
