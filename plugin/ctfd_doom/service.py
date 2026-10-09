import json
import time
from datetime import datetime, timedelta

from . import clock, messages as msgmod, rounds as rd
from .clock import Window, as_utc, utcnow
from .content import render_broadcast


def iso(dt):
    return None if dt is None else as_utc(dt).isoformat().replace("+00:00", "Z")


def parse_iso(s):
    s = s.strip().replace("Z", "+00:00")
    return as_utc(datetime.fromisoformat(s))


class DoomService:
    def __init__(self, adapter, store, content, *, state_ttl=5.0, stats_ttl=15.0,
                 dev=False, real_now=utcnow, query_clock=None):
        self.adapter, self.store, self.content = adapter, store, content
        self.state_ttl, self.stats_ttl, self.dev = state_ttl, stats_ttl, dev
        self.real_now = real_now
        self.query_clock = query_clock  # callable returning minutes since start, or None
        self._cache = {}

    # ---- cache ---------------------------------------------------------
    def _cached(self, key, ttl, fn):
        if ttl <= 0:
            return fn()
        hit = self._cache.get(key)
        t = time.monotonic()
        if hit and hit[0] > t:
            return hit[1]
        val = fn()
        self._cache[key] = (t + ttl, val)
        return val

    def clear_cache(self):
        self._cache.clear()

    # ---- time ----------------------------------------------------------
    def window(self):
        w = self.adapter.window()
        return None if w is None else Window(as_utc(w[0]), as_utc(w[1]))

    def paused_at(self):
        v = self.store.get_setting("paused_at")
        return parse_iso(v) if v else None

    def offset_minutes(self):
        return float(self.store.get_setting("clock_offset_minutes", "0") or 0)

    def now(self, w=None):
        if self.dev and self.query_clock is not None:
            minutes = self.query_clock()
            w = w or self.window()
            if minutes is not None and w is not None:
                return w.start + timedelta(minutes=minutes)
        return clock.effective_now(self.real_now(), self.offset_minutes(), self.paused_at())

    def gate_on(self):
        v = self.store.get_setting("gate_by_clock")
        if v is not None:
            return v == "1"
        try:
            ts = json.loads(self.adapter.get_config("theme_settings", "{}") or "{}")
            if "gate_by_clock" in ts:
                return bool(ts["gate_by_clock"])
        except (ValueError, TypeError):
            pass
        return True

    # ---- rounds --------------------------------------------------------
    def rounds(self):
        w = self.window()
        rs = self.store.rounds()
        if not rs and w is not None:
            rs = rd.default_rounds(w, rd.DEFAULT_ROUND_COUNT)
            self.store.replace_rounds(rs)
        return rs

    def _ids(self):
        """Challenge id maps built from CTFd plus bundled content."""
        chals = self.adapter.all_challenges() if hasattr(self.adapter, "all_challenges") \
            else self.adapter.challenges()
        region_of, key_of, by_id = {}, {}, {}
        for c in chals:
            by_id[c["id"]] = c
            meta = self.content.by_name.get(c["name"])
            region = (meta or {}).get("region") or self.content.region_for_category(c["category"])
            if region:
                region_of[c["id"]] = region
            if meta:
                key_of[c["id"]] = meta["key"]
        return region_of, key_of, by_id

    # ---- public reads --------------------------------------------------
    def state(self, account_id):
        return self._cached(("state", account_id), self.state_ttl, lambda: self._state(account_id))

    def _state(self, account_id):
        w = self.window()
        if w is None:
            return {"configured": False, "act": "PRE", "phase": 0, "incursion": 0.0,
                    "incursion_hours_left": clock.INCURSION_HOURS, "rounds_total": 0,
                    "next_phase_at": None, "released_by_region": {}, "team_solves": 0,
                    "now": iso(self.real_now())}
        now = self.now(w)
        rs = self.rounds()
        asg = self.store.assignments()
        region_of, key_of, _ = self._ids()
        rel = rd.released_by_region(asg, region_of, rs, now)
        if not self.gate_on():
            rel = {}
            for cid, region in region_of.items():
                o = rel.setdefault(region, {"released": 0, "total": 0})
                o["released"] += 1
                o["total"] += 1
        if self.gate_on():
            open_ids = rd.unlocked_challenge_ids(asg, rs, now)
            order = [cid for cid, _, _ in self.store.assignment_rows() if cid in open_ids]
        else:
            order = sorted(region_of)
        solves = self.adapter.team_solves(account_id)
        bonus_open = any(r.kind == rd.BONUS and rd.is_open(r, now) for r in rs)
        return {
            "configured": True,
            "now": iso(now),
            "server_time": iso(self.real_now()),
            "event_start": iso(w.start),
            "event_end": iso(w.end),
            "incursion_hours_left": round(clock.incursion_hours_left(w, now), 4),
            "incursion": round(clock.incursion_level(w, now), 5),
            "story_hour": round(clock.story_hour(w, now), 4),
            "act": clock.act_for(w, now),
            "oath_beat": clock.oath_beat(w, now),
            "phase": rd.phase(rs, now),
            "rounds_total": rd.normal_count(rs),
            "next_phase_at": iso(rd.next_phase_at(rs, now)),
            "released_by_region": rel,
            "released_order": order,
            "bonus_revealed": bonus_open,
            "gate_on": self.gate_on(),
            "paused": self.paused_at() is not None,
            "team_solves": len(solves),
        }

    def stats(self):
        return self._cached("stats", self.stats_ttl, self._stats)

    def _stats(self):
        s = self.adapter.summary()
        region_of, key_of, by_id = self._ids()
        region_solves = {}
        for cid, n in s["by_challenge"].items():
            r = region_of.get(cid)
            if r:
                region_solves[r] = region_solves.get(r, 0) + n
        fb = {}
        for cid, team in s["first_blood"].items():
            k = key_of.get(cid)
            if k:
                fb[k] = team
        w = self.window()
        left = clock.incursion_hours_left(w, self.now(w)) if w else clock.INCURSION_HOURS
        return {"teams": s["teams"], "total_solves": s["total_solves"],
                "region_solves": region_solves, "top_team": s["top_team"],
                "top10": s["top10"], "first_blood": fb, "incursion_hours_left": left}

    def broadcasts(self):
        w = self.window()
        if w is None:
            return []
        now = self.now(w)
        out = []
        stats = None
        high_if = self.content.broadcast_cfg.get("high_if_solves_per_team", 2)
        for b in self.content.broadcast_cfg["broadcasts"]:
            if not clock.broadcast_due(w, now, b["hour"]):
                continue
            snap = self.store.snapshot(b["key"])
            if snap is None:
                stats = stats or dict(self.stats())
                st = dict(stats, incursion_hours_left=clock.INCURSION_HOURS - b["hour"] / 3.0)
                text, sub = render_broadcast(b, st, high_if)
                snap = self.store.save_snapshot(b["key"], text, sub, now)
            out.append({"key": b["key"], "hour": b["hour"], "title": b["title"],
                        "text": snap[0], "subtitle": snap[1], "rendered_at": iso(snap[2])})
        return out

    def _solved_keys(self, account_id):
        _, key_of, _ = self._ids()
        return {key_of[s["challenge_id"]] for s in self.adapter.team_solves(account_id)
                if s["challenge_id"] in key_of}

    def codex(self, account_id):
        solved = self._solved_keys(account_id)
        w = self.window()
        rs = self.rounds() if w else []
        now = self.now(w) if w else self.real_now()
        bonus_open = any(r.kind == rd.BONUS and rd.is_open(r, now) for r in rs)
        unlocked, locked = [], []
        tier_of = {c["key"]: c["tier"] for c in self.content.challenges + self.content.bonus}
        name_of = {c["key"]: c["name"] for c in self.content.challenges + self.content.bonus}
        for i, (key, e) in enumerate(sorted(self.content.codex.items())):
            is_bonus = key.startswith("bonus-")
            if key in solved:
                unlocked.append({"id": key, "title": name_of.get(key, key), "region": e["region"],
                                 "kind": e["kind"], "tier": tier_of.get(key), "text": e["text"],
                                 "locked": False})
            elif not is_bonus or bonus_open:
                locked.append({"id": "locked-%02d" % i, "region": e["region"],
                               "tier": tier_of.get(key), "locked": True})
        return {"unlocked": unlocked, "locked": locked}

    def messages(self, account_id):
        w = self.window()
        solved = self._solved_keys(account_id)
        act = clock.act_for(w, self.now(w)) if w else "PRE"
        released = self.released_keys(w)
        totals = {}
        for k in released:
            meta = self.content.by_key.get(k)
            if meta:
                totals.setdefault(meta["region"], []).append(k)
        got = msgmod.earned(self.content.messages, solved, totals, None, act)
        read = self.store.read_ids(account_id)
        return [{"id": m["id"], "from": m["from"], "subject": m["subject"],
                 "text": m["text"], "read": m["id"] in read} for m in got]

    def released_keys(self, w=None):
        w = w or self.window()
        _, key_of, _ = self._ids()
        if w is None:
            return set()
        if not self.gate_on():
            return set(key_of.values())
        ids = rd.unlocked_challenge_ids(self.store.assignments(), self.rounds(), self.now(w))
        return {key_of[i] for i in ids if i in key_of}

    def mark_read(self, account_id, message_id):
        valid = {m["id"] for m in self.content.messages}
        if message_id not in valid:
            return False
        self.store.mark_read(account_id, message_id, self.real_now())
        return True

    # ---- gating --------------------------------------------------------
    def gate(self, challenge_id, is_admin):
        w = self.window()
        if is_admin or not self.gate_on():
            return True, None, "bypass"
        if w is None:
            return True, None, "unconfigured"
        return rd.gate_decision(challenge_id, self.store.assignments(), self.rounds(),
                                self.now(w), w, is_admin=False, gate_on=True)

    def visible_ids(self, is_admin):
        w = self.window()
        if is_admin or not self.gate_on() or w is None:
            return None  # None means everything
        return rd.unlocked_challenge_ids(self.store.assignments(), self.rounds(), self.now(w))

    # ---- admin ---------------------------------------------------------
    def _log(self, actor, action, detail):
        self.store.audit(actor, action, detail, self.real_now())
        self.clear_cache()

    def board(self):
        w = self.window()
        rs = self.rounds() if w else []
        now = self.now(w) if w else self.real_now()
        asg = {r[0]: (r[1], r[2]) for r in self.store.assignment_rows()}
        region_of, key_of, by_id = self._ids()
        pool = []
        for cid, c in sorted(by_id.items(), key=lambda kv: (kv[1]["category"], kv[1]["name"])):
            n, order = asg.get(cid, (None, 0))
            pool.append({"id": cid, "name": c["name"], "category": c["category"],
                         "value": c["value"], "state": c.get("state"), "region": region_of.get(cid),
                         "round_n": n, "sort_order": order})
        warnings = rd.coverage_warnings({c: a[0] for c, a in asg.items()}, region_of,
                                        self.content.region_ids, rs) if rs else []
        return {
            "configured": w is not None,
            "window": None if w is None else {"start": iso(w.start), "end": iso(w.end)},
            "now": iso(now),
            "clock": {"offset_minutes": self.offset_minutes(), "paused": self.paused_at() is not None,
                      "gate_by_clock": self.gate_on(), "dev": self.dev},
            "rounds": [{"n": r.n, "name": r.name, "opens_at": iso(r.opens_at), "status": r.status,
                        "kind": r.kind, "open": rd.is_open(r, now),
                        "count": sum(1 for x in asg.values() if x[0] == r.n)} for r in rs],
            "pool": pool,
            "warnings": warnings,
            "audit": self.store.audit_tail(30),
        }

    def rounds_action(self, p, actor):
        w = self.window()
        if w is None:
            raise ValueError("Set the CTF start and end times in CTFd first.")
        rs = {r.n: r for r in self.rounds()}
        act = p.get("action")
        if act == "set_count":
            count = int(p["count"])
            if not 1 <= count <= 40:
                raise ValueError("Round count must be between 1 and 40.")
            old = {n: r for n, r in rs.items() if r.kind == rd.NORMAL}
            bonus = [r for r in rs.values() if r.kind == rd.BONUS]
            fresh = []
            for r in rd.default_rounds(w, count):
                if r.n in old:  # keep names and status; times are re-spaced evenly
                    r = rd.Round(r.n, old[r.n].name, r.opens_at, old[r.n].status, rd.NORMAL)
                fresh.append(r)
            mapping = {n: (n if n <= count else None) for n in old}
            for b in bonus:
                mapping[b.n] = count + 1
                fresh.append(rd.Round(count + 1, b.name, b.opens_at, b.status, rd.BONUS))
            self.store.move_round_assignments(mapping)
            self.store.replace_rounds(fresh)
        elif act == "reset_default":
            self.store.replace_rounds(rd.default_rounds(w, rd.normal_count(list(rs.values())) or rd.DEFAULT_ROUND_COUNT))
        elif act == "create":
            kind = p.get("kind", rd.NORMAL)
            n = max(rs) + 1 if rs else 1
            if kind == rd.BONUS:
                if any(r.kind == rd.BONUS for r in rs.values()):
                    raise ValueError("A hidden set already exists.")
                r = rd.bonus_round(w, n, p.get("hour", rd.DEFAULT_BONUS_HOUR), p.get("name", "Hidden Set"))
            else:
                opens = parse_iso(p["opens_at"]) if p.get("opens_at") else w.end - timedelta(minutes=1)
                r = rd.Round(n, p.get("name") or "Round %d" % n, opens)
            self.store.upsert_round(r)
        else:
            n = int(p["n"])
            if n not in rs:
                raise ValueError("No such round: %d" % n)
            r = rs[n]
            if act == "rename":
                r = rd.Round(r.n, str(p["name"])[:128], r.opens_at, r.status, r.kind)
            elif act == "retime":
                r = rd.Round(r.n, r.name, parse_iso(p["opens_at"]), r.status, r.kind)
            elif act == "hold":
                r = rd.Round(r.n, r.name, r.opens_at, rd.HELD, r.kind)
            elif act == "release":
                r = rd.Round(r.n, r.name, r.opens_at, rd.OPEN, r.kind)
            elif act == "schedule":
                r = rd.Round(r.n, r.name, r.opens_at, rd.SCHEDULED, r.kind)
            elif act == "delete":
                self.store.delete_round(n)
                self._log(actor, "round.delete", p)
                return self.board()
            else:
                raise ValueError("Unknown action: %s" % act)
            self.store.upsert_round(r)
        self._log(actor, "round." + str(act), p)
        return self.board()

    def assign(self, items, actor):
        valid_rounds = {r.n for r in self.rounds()}
        known = {c["id"] for c in self.adapter.all_challenges()}
        rows = []
        for it in items:
            cid = int(it["challenge_id"])
            if cid not in known:
                raise ValueError("Unknown challenge id %d" % cid)
            n = it.get("round_n")
            if n is not None:
                n = int(n)
                if n not in valid_rounds:
                    raise ValueError("Unknown round %d" % n)
            rows.append((cid, n, int(it.get("sort_order", 0))))
        self.store.set_assignments(rows)
        self._log(actor, "assign", {"count": len(rows)})
        return self.board()

    def seed_from_content(self, actor):
        w = self.window()
        if w is None:
            raise ValueError("Set the CTF start and end times in CTFd first.")
        rs = self.rounds()
        normal = [r.n for r in rs if r.kind == rd.NORMAL]
        bonus = next((r for r in rs if r.kind == rd.BONUS), None)
        items, order = [], {}
        chals = self.adapter.all_challenges()
        for c in sorted(chals, key=lambda c: c["id"]):
            meta = self.content.by_name.get(c["name"])
            if not meta:
                continue
            if meta["round"] == "bonus":
                if bonus is None:
                    self.store.upsert_round(rd.bonus_round(w, max(r.n for r in rs) + 1))
                    rs = self.rounds()
                    bonus = next(r for r in rs if r.kind == rd.BONUS)
                n = bonus.n
            else:
                n = min(int(meta["round"]), max(normal))
            order[n] = order.get(n, 0) + 1
            items.append({"challenge_id": c["id"], "round_n": n, "sort_order": order[n]})
        return self.assign(items, actor)

    def clock_action(self, p, actor):
        w = self.window()
        if w is None and any(k in p for k in ("pause", "set_story_hour")):
            raise ValueError("Set the CTF start and end times in CTFd first.")
        if "gate" in p:
            self.store.set_setting("gate_by_clock", "1" if p["gate"] else "0")
        if p.get("pause"):
            if self.paused_at() is None:
                self.store.set_setting("paused_at", iso(self.now(w)))
        elif p.get("resume"):
            paused = self.paused_at()
            if paused is not None:
                off = (paused - self.real_now()).total_seconds() / 60.0
                self.store.set_setting("clock_offset_minutes", off)
                self.store.set_setting("paused_at", None)
        elif "offset_minutes" in p:
            self.store.set_setting("clock_offset_minutes", float(p["offset_minutes"]))
            self.store.set_setting("paused_at", None)
        elif "set_story_hour" in p:
            if w is None:
                raise ValueError("Set the CTF start and end times in CTFd first.")
            target = w.at_story_hour(float(p["set_story_hour"]))
            off = (target - self.real_now()).total_seconds() / 60.0
            self.store.set_setting("clock_offset_minutes", off)
            self.store.set_setting("paused_at", None)
        elif p.get("reset"):
            self.store.set_setting("clock_offset_minutes", 0)
            self.store.set_setting("paused_at", None)
        self._log(actor, "clock", p)
        return self.board()
