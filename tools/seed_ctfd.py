#!/usr/bin/env python3
"""Seed a running CTFd with placeholder challenges through its admin API.

Default: the 54 challenges from content/ (10 regions, 8 rounds), flag MVSR{demo},
max_attempts 5, two hints each. Then asks ctfd-doom to assign them to rounds.

  python3 tools/seed_ctfd.py --url http://localhost:8000 --token ctfd_xxx
  python3 tools/seed_ctfd.py --token ctfd_xxx --rounds 10 --per-round 12
  python3 tools/seed_ctfd.py --token ctfd_xxx --bonus        # also the 6 hidden ones

Never run this against production: every flag is the same.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(HERE, "..", "content")


def load_json(*parts):
    with open(os.path.join(CONTENT, *parts), encoding="utf-8") as f:
        return json.load(f)


class Api:
    def __init__(self, url, token, dry=False):
        self.url, self.token, self.dry = url.rstrip("/"), token, dry

    def call(self, method, path, body=None):
        if self.dry and method != "GET":
            print("  [dry] %s %s %s" % (method, path, json.dumps(body)[:100]))
            return {"success": True, "data": {"id": -1}}
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.url + path, data=data, method=method, headers={
            "Authorization": "Token " + self.token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            raise SystemExit("%s %s failed: HTTP %d %s" % (method, path, e.code, e.read()[:300].decode("utf-8", "replace")))


def description(region, name, tagline):
    return ("%s\n\nPLACEHOLDER CHALLENGE. This is a stand-in so the story, gating and codex can be tested.\n\n"
            "To solve it, submit the flag MVSR{demo}.") % tagline


def build_default(include_bonus):
    regions = {r["id"]: r for r in load_json("regions.json")["regions"]}
    out = []
    for f in sorted(os.listdir(os.path.join(CONTENT, "challenges"))):
        d = load_json("challenges", f)
        if "bonus" in d:
            if include_bonus:
                for b in d["bonus"]:
                    r = regions[b["region"]]
                    out.append(dict(name=b["name"], category=r["category"], value=b["value"],
                                    tagline=r["tagline"], round="bonus", region=b["region"]))
            continue
        for c in d["challenges"]:
            out.append(dict(name=c["name"], category=d["category"], value=c["value"],
                            tagline=regions[d["region"]]["tagline"], round=c["round"], region=d["region"]))
    return out


def build_generic(rounds, per_round):
    regions = load_json("regions.json")["regions"]
    values = [50, 50, 50, 100, 50, 100, 150, 200]
    out, i = [], 0
    for rnd in range(1, rounds + 1):
        for k in range(per_round):
            r = regions[(i if rnd > 1 else k) % len(regions)]
            out.append(dict(name="Placeholder R%02d-%02d" % (rnd, k + 1), category=r["category"],
                            value=values[i % len(values)], tagline=r["tagline"], round=rnd, region=r["id"]))
            i += 1
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=os.environ.get("CTFD_URL", "http://localhost:8000"))
    ap.add_argument("--token", default=os.environ.get("CTFD_TOKEN"))
    ap.add_argument("--rounds", type=int, default=None, help="with --per-round: a generic set of this many rounds")
    ap.add_argument("--per-round", type=int, default=None)
    ap.add_argument("--flag", default="MVSR{demo}")
    ap.add_argument("--max-attempts", type=int, default=5)
    ap.add_argument("--bonus", action="store_true", help="also create the 6 hidden bonus challenges")
    ap.add_argument("--no-assign", action="store_true", help="do not call the ctfd-doom assignment endpoint")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if not a.token:
        ap.error("--token (or CTFD_TOKEN) is required: Admin > Settings > Access Tokens")
    generic = a.rounds is not None or a.per_round is not None
    if generic and not (a.rounds and a.per_round):
        ap.error("--rounds and --per-round go together")
    plan = build_generic(a.rounds, a.per_round) if generic else build_default(a.bonus)
    api = Api(a.url, a.token, a.dry_run)

    existing = {}
    for c in api.call("GET", "/api/v1/challenges?view=admin")["data"]:
        existing[c["name"]] = c["id"]
    created = skipped = 0
    for c in plan:
        if c["name"] in existing:
            skipped += 1
            continue
        res = api.call("POST", "/api/v1/challenges", {
            "name": c["name"], "category": c["category"], "value": c["value"], "state": "visible",
            "type": "standard", "max_attempts": a.max_attempts,
            "description": description(c["region"], c["name"], c["tagline"]),
        })
        cid = res["data"]["id"]
        existing[c["name"]] = cid
        api.call("POST", "/api/v1/flags", {"challenge_id": cid, "content": a.flag, "type": "static", "data": ""})
        api.call("POST", "/api/v1/hints", {"challenge_id": cid, "cost": max(5, c["value"] // 10),
                                           "content": "Boris: start with the fiction, then find the plain requirement."})
        api.call("POST", "/api/v1/hints", {"challenge_id": cid, "cost": max(10, c["value"] // 5),
                                           "content": "Boris: this is a placeholder. The flag is %s." % a.flag})
        created += 1
        print("created %-28s %-26s %4d" % (c["name"], c["category"], c["value"]))
    print("%d created, %d already existed" % (created, skipped))

    if a.no_assign or a.dry_run:
        return 0
    try:
        if generic:
            api.call("POST", "/api/doom/v1/admin/rounds", {"action": "set_count", "count": a.rounds})
            items, order = [], {}
            for c in plan:
                order[c["round"]] = order.get(c["round"], 0) + 1
                items.append({"challenge_id": existing[c["name"]], "round_n": c["round"],
                              "sort_order": order[c["round"]]})
            api.call("POST", "/api/doom/v1/admin/assignments", {"assignments": items})
        else:
            api.call("POST", "/api/doom/v1/admin/seed", {})
        print("assigned challenges to rounds")
    except SystemExit as e:
        print("could not assign rounds (is the ctfd-doom plugin loaded?): %s" % e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
