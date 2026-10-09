from datetime import datetime, timedelta, timezone

from ctfd_doom.content import Content

START = datetime(2026, 11, 1, 6, 0, tzinfo=timezone.utc)
END = START + timedelta(hours=24)


class FakeAdapter:
    """Same surface as CTFdAdapter, backed by plain python data."""

    def __init__(self, content=None):
        self.content = content or Content()
        self._window = (START, END)
        self.user = {"account_id": 1, "user_id": 1, "is_admin": False, "name": "team-one"}
        self.chals = []
        self.solves = {}      # account_id -> [challenge_id]
        self.names = {1: "team-one", 2: "team-two", 3: "team-three"}
        self.hints = {}       # hint_id -> challenge_id
        self.config = {}
        for i, c in enumerate(self.content.challenges + self.content.bonus, start=1):
            self.chals.append({"id": i, "name": c["name"], "category": c.get("category") or
                               next(r["category"] for r in self.content.regions if r["id"] == c["region"]),
                               "value": c["value"], "state": "visible"})

    def id_of(self, key):
        name = self.content.by_key[key]["name"]
        return next(c["id"] for c in self.chals if c["name"] == name)

    def get_config(self, key, default=None):
        return self.config.get(key, default)

    def window(self):
        return self._window

    def current(self):
        return self.user

    def challenges(self):
        return list(self.chals)

    all_challenges = challenges

    def team_solves(self, account_id):
        return [{"challenge_id": c, "date": START} for c in self.solves.get(account_id, [])]

    def summary(self):
        by, first, total = {}, {}, 0
        for acct, ids in self.solves.items():
            for cid in ids:
                total += 1
                by[cid] = by.get(cid, 0) + 1
                first.setdefault(cid, self.names[acct])
        ranked = sorted(self.solves, key=lambda a: -len(self.solves[a]))
        top = self.names[ranked[0]] if ranked else None
        return {"teams": len(self.names), "total_solves": total, "by_challenge": by,
                "first_blood": first, "top_team": top,
                "top10": [{"account_id": a, "name": self.names[a], "score": 100 * len(self.solves[a])}
                          for a in ranked]}

    def hint_challenge(self, hint_id):
        return self.hints.get(hint_id)
