"""The only module that talks to CTFd internals.

Written against CTFd 3.7. Tests replace it with a fake that has the same surface.
"""
from datetime import datetime, timezone


def _to_dt(v):
    if v in (None, "", 0, "0"):
        return None
    return datetime.fromtimestamp(int(float(v)), tz=timezone.utc)


class CTFdAdapter:
    def get_config(self, key, default=None):
        from CTFd.utils import get_config
        v = get_config(key)
        return default if v is None else v

    def window(self):
        start, end = _to_dt(self.get_config("start")), _to_dt(self.get_config("end"))
        if start and end and end > start:
            return start, end
        return None

    def current(self):
        """{'account_id', 'user_id', 'is_admin', 'name'} or None."""
        from CTFd.utils.user import get_current_team, get_current_user, is_admin
        user = get_current_user()
        if user is None:
            return None
        team = get_current_team()
        return {"account_id": team.id if team else user.id, "user_id": user.id,
                "is_admin": bool(is_admin()), "name": user.name}

    def challenges(self):
        from CTFd.models import Challenges
        rows = Challenges.query.filter(Challenges.state != "hidden").all()
        return [{"id": c.id, "name": c.name, "category": c.category,
                 "value": c.value, "state": c.state} for c in rows]

    def all_challenges(self):
        from CTFd.models import Challenges
        return [{"id": c.id, "name": c.name, "category": c.category, "value": c.value,
                 "state": c.state} for c in Challenges.query.all()]

    def team_solves(self, account_id):
        from CTFd.models import Solves
        return [{"challenge_id": s.challenge_id, "date": s.date}
                for s in Solves.query.filter(Solves.account_id == account_id).all()]

    def summary(self):
        """Public counters. Hidden and banned accounts are excluded."""
        from CTFd.models import Solves, Teams, Users, db
        from CTFd.utils import get_config
        from CTFd.utils.modes import TEAMS_MODE
        teams_mode = get_config("user_mode") == "teams"
        acct = Teams if teams_mode else Users
        accounts = {a.id: a.name for a in acct.query.filter_by(hidden=False, banned=False).all()}
        solves = Solves.query.order_by(Solves.date.asc()).all()
        by_challenge, first, total = {}, {}, 0
        for s in solves:
            if s.account_id not in accounts:
                continue
            total += 1
            by_challenge[s.challenge_id] = by_challenge.get(s.challenge_id, 0) + 1
            first.setdefault(s.challenge_id, accounts[s.account_id])
        top = None
        try:
            from CTFd.utils.scores import get_standings
            standings = get_standings(count=10)
            if standings:
                top = standings[0].name
            top10 = [{"account_id": s.account_id, "name": s.name, "score": int(s.score or 0)}
                     for s in standings]
        except Exception:  # standings API differs between minor versions
            top10 = []
        return {"teams": len(accounts), "total_solves": total, "by_challenge": by_challenge,
                "first_blood": first, "top_team": top, "top10": top10}

    def hint_challenge(self, hint_id):
        from CTFd.models import Hints
        h = db_get(Hints, hint_id)
        return None if h is None else h.challenge_id


def db_get(model, pk):
    from CTFd.models import db
    return db.session.get(model, pk)
