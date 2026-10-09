"""End to end through the Flask routes: state, gating, broadcasts, codex, messages, admin."""
import json
from datetime import timedelta

from .fakes import START

H = lambda e, h: e.clock.at_hour(h)


def j(resp):
    return json.loads(resp.get_data(as_text=True))


def listed(e):
    return {c["name"] for c in j(e.client.get("/api/v1/challenges"))["data"]}


def test_state_shape_and_requires_login(env):
    env.adapter.user = None
    assert env.client.get("/api/doom/v1/state").status_code == 403
    env.adapter.user = {"account_id": 1, "user_id": 1, "is_admin": False, "name": "t"}
    s = j(env.client.get("/api/doom/v1/state"))
    for k in ("now", "incursion_hours_left", "incursion", "act", "phase", "rounds_total",
              "next_phase_at", "released_by_region", "team_solves"):
        assert k in s
    assert s["rounds_total"] == 8 and s["phase"] == 1 and s["act"] == "I"


def test_phase_release_exactly_at_each_three_hour_boundary(env):
    released = []
    for h in range(0, 24, 3):
        H(env, h)
        s = j(env.client.get("/api/doom/v1/state"))
        released.append(sum(r["released"] for r in s["released_by_region"].values()))
        assert s["phase"] == h // 3 + 1
    # cumulative: 10, 18, 25, 32, 38, 44, 49, 54
    assert released == [10, 18, 25, 32, 38, 44, 49, 54]


def test_every_region_is_open_in_round_one(env):
    s = j(env.client.get("/api/doom/v1/state"))
    assert all(r["released"] >= 1 for r in s["released_by_region"].values())
    assert len(s["released_by_region"]) == 10


def test_challenge_list_only_shows_released(env):
    names = listed(env)
    assert len(names) == 10
    assert "Petition Box" in names and "Tax Ledger" not in names
    H(env, 3)
    assert "Tax Ledger" in listed(env)


def test_locked_challenge_cannot_be_read_or_attacked_directly(env):
    cid = env.adapter.id_of("doomstadt-tax-ledger")  # round 2, opens at hour 3
    for resp in (env.client.get("/api/v1/challenges/%d" % cid),
                 env.client.get("/api/v1/challenges/%d/solves" % cid),
                 env.client.post("/api/v1/challenges/attempt",
                                 json={"challenge_id": cid, "submission": "x"})):
        assert resp.status_code == 403
        body = j(resp)
        assert body["success"] is False
        assert body["locked_until"] == 7  # unlocks when 7 incursion hours remain
    H(env, 3)
    assert env.client.get("/api/v1/challenges/%d" % cid).status_code == 200
    assert env.client.post("/api/v1/challenges/attempt",
                           json={"challenge_id": cid, "submission": "x"}).status_code == 200


def test_hints_follow_their_challenge(env):
    cid = env.adapter.id_of("doomstadt-tax-ledger")
    env.adapter.hints[500] = cid
    assert env.client.get("/api/v1/hints/500").status_code == 403
    H(env, 3)
    assert env.client.get("/api/v1/hints/500").status_code == 200


def test_unassigned_challenges_stay_hidden(env):
    cid = env.adapter.id_of("doomstadt-petition-box")
    env.svc.assign([{"challenge_id": cid, "round_n": None}], "t")
    assert "Petition Box" not in listed(env)
    assert env.client.get("/api/v1/challenges/%d" % cid).status_code == 403


def test_admin_bypasses_gating(env):
    env.adapter.user = dict(env.adapter.user, is_admin=True)
    cid = env.adapter.id_of("citadel-doomsday-engine")
    assert env.client.get("/api/v1/challenges/%d" % cid).status_code == 200
    assert len(listed(env)) == 60


def test_gate_off_is_free_roam(env):
    env.svc.clock_action({"gate": False}, "t")
    assert len(listed(env)) == 60
    env.svc.clock_action({"gate": True}, "t")
    assert len(listed(env)) == 10


def test_hour_22_bonus_reveal(env):
    H(env, 21)
    assert "Last Word" not in listed(env)
    s = j(env.client.get("/api/doom/v1/state"))
    assert s["bonus_revealed"] is False
    assert sum(r["total"] for r in s["released_by_region"].values()) == 54, "bonus is not even counted"
    env.clock.t = START + timedelta(hours=22)
    assert "Last Word" in listed(env)
    s = j(env.client.get("/api/doom/v1/state"))
    assert s["bonus_revealed"] is True
    assert sum(r["total"] for r in s["released_by_region"].values()) == 60


def test_held_round_blocks_then_release_now_opens(env):
    H(env, 3)
    assert "Tax Ledger" in listed(env)
    env.svc.rounds_action({"action": "hold", "n": 2}, "t")
    assert "Tax Ledger" not in listed(env)
    assert j(env.client.get("/api/doom/v1/state"))["phase"] == 1
    env.svc.rounds_action({"action": "release", "n": 3}, "t")
    assert "Petition Box" in listed(env) and "Border Post" in listed(env)


def test_round_count_9_and_10(env):
    for count, step in ((9, 24 / 9), (10, 2.4)):
        env.svc.rounds_action({"action": "set_count", "count": count}, "t")
        for i in range(count):
            env.clock.t = START + timedelta(hours=step * i, seconds=1)
            assert j(env.client.get("/api/doom/v1/state"))["phase"] == i + 1
        assert j(env.client.get("/api/doom/v1/state"))["rounds_total"] == count


def test_changing_round_count_keeps_bonus_set_and_drops_orphans(env):
    env.svc.rounds_action({"action": "set_count", "count": 5}, "t")
    board = env.svc.board()
    assert [r["n"] for r in board["rounds"]] == [1, 2, 3, 4, 5, 6]
    assert board["rounds"][-1]["kind"] == "bonus"
    pool = {p["name"]: p["round_n"] for p in board["pool"]}
    assert pool["Last Word"] == 6
    assert pool["Doomsday Engine"] is None  # was in round 8, which no longer exists
    assert pool["Petition Box"] == 1


def test_clock_offset_pause_and_resume(env):
    env.svc.clock_action({"set_story_hour": 6}, "t")
    s = j(env.client.get("/api/doom/v1/state"))
    assert s["act"] == "II" and s["incursion_hours_left"] == 6
    env.svc.clock_action({"pause": True}, "t")
    env.clock.t += timedelta(hours=5)
    assert j(env.client.get("/api/doom/v1/state"))["incursion_hours_left"] == 6
    env.svc.clock_action({"resume": True}, "t")
    env.clock.t += timedelta(hours=3)
    assert j(env.client.get("/api/doom/v1/state"))["story_hour"] == 9


def test_admin_routes_need_admin(env):
    assert env.client.post("/api/doom/v1/admin/clock", json={"pause": True}).status_code == 403
    env.adapter.user = dict(env.adapter.user, is_admin=True)
    r = env.client.post("/api/doom/v1/admin/clock", json={"offset_minutes": 60})
    assert r.status_code == 200 and j(r)["data"]["clock"]["offset_minutes"] == 60
    assert env.client.post("/api/doom/v1/admin/rounds", json={"action": "nope"}).status_code == 400
    audit = j(env.client.get("/api/doom/v1/admin/board"))["data"]["audit"]
    assert any(a["action"] == "clock" for a in audit)


def test_bulk_assignment_validates_ids(env):
    env.adapter.user = dict(env.adapter.user, is_admin=True)
    bad = env.client.post("/api/doom/v1/admin/assignments",
                          json={"assignments": [{"challenge_id": 99999, "round_n": 1}]})
    assert bad.status_code == 400
    bad = env.client.post("/api/doom/v1/admin/assignments",
                          json={"assignments": [{"challenge_id": 1, "round_n": 77}]})
    assert bad.status_code == 400


def test_board_warns_about_empty_first_round(env):
    env.adapter.user = dict(env.adapter.user, is_admin=True)
    cid = env.adapter.id_of("baxter-blackboard")
    env.svc.assign([{"challenge_id": cid, "round_n": 2}], "t")
    w = env.svc.board()["warnings"]
    assert any(x["code"] == "empty_first_round" and x["region"] == "baxter" for x in w)


def test_new_challenge_added_in_ctfd_is_unassigned_and_hidden(env):
    new_id = 5000
    env.adapter.chals.append({"id": new_id, "name": "Organiser Added", "category": "OSINT",
                              "value": 100, "state": "visible"})
    assert "Organiser Added" not in listed(env)
    row = [p for p in env.svc.board()["pool"] if p["id"] == new_id][0]
    assert row["round_n"] is None


def test_broadcasts_render_once_and_are_snapshotted(env):
    assert [b["key"] for b in j(env.client.get("/api/doom/v1/broadcasts"))["data"]] == ["h0"]
    H(env, 3)
    env.adapter.solves[1] = [env.adapter.id_of("doomstadt-petition-box")]
    first = j(env.client.get("/api/doom/v1/broadcasts"))["data"]
    assert [b["key"] for b in first] == ["h0", "h3"]
    assert "7" in first[1]["text"] and "{" not in first[1]["text"], "placeholders resolved"
    # stats change later; the stored text must not
    env.adapter.solves[2] = [env.adapter.id_of("embassy-shell-company")] * 1
    again = j(env.client.get("/api/doom/v1/broadcasts"))["data"]
    assert again[1]["text"] == first[1]["text"]
    H(env, 24)
    keys = [b["key"] for b in j(env.client.get("/api/doom/v1/broadcasts"))["data"]]
    assert keys == ["h0", "h3", "h6", "h9", "h12", "h15", "h18", "h21", "h24"]


def test_every_broadcast_variant_resolves_every_placeholder(env, content):
    from ctfd_doom.content import TOKEN, render
    stats = {"teams": 12, "total_solves": 30, "top_team": "T", "incursion_hours_left": 4,
             "region_solves": {r: 1 for r in content.region_ids}, "first_blood": {}}
    for b in content.broadcast_cfg["broadcasts"]:
        for text in list(b["variants"].values()) + [b["subtitle"]]:
            assert "{" not in render(text, stats)


def test_codex_unlocks_by_solve_and_hides_locked_text(env):
    env.adapter.solves[1] = [env.adapter.id_of("foundry-assembly-line")]
    data = j(env.client.get("/api/doom/v1/codex"))["data"]
    assert [e["id"] for e in data["unlocked"]] == ["foundry-assembly-line"]
    assert 60 <= len(data["unlocked"][0]["text"].split()) <= 120
    assert len(data["locked"]) == 53, "bonus entries are not even listed before the reveal"
    blob = json.dumps(data["locked"])
    assert "text" not in blob and "petition" not in blob.lower()
    H(env, 22)
    data = j(env.client.get("/api/doom/v1/codex"))["data"]
    assert len(data["locked"]) == 59


def test_messages_thresholds_and_read_flags(env):
    assert j(env.client.get("/api/doom/v1/messages"))["data"] == []
    env.adapter.solves[1] = [env.adapter.id_of("foundry-assembly-line")]
    msgs = j(env.client.get("/api/doom/v1/messages"))["data"]
    assert [m["id"] for m in msgs] == ["shuri-1"] and msgs[0]["read"] is False
    assert env.client.post("/api/doom/v1/messages/shuri-1/read").status_code == 200
    assert j(env.client.get("/api/doom/v1/messages"))["data"][0]["read"] is True
    assert env.client.post("/api/doom/v1/messages/nope/read").status_code == 404
    H(env, 9)  # act II
    ids = {m["id"] for m in j(env.client.get("/api/doom/v1/messages"))["data"]}
    assert {"shuri-4", "strange-1"} <= ids


def test_messages_are_per_team(env):
    env.adapter.solves[2] = [env.adapter.id_of("foundry-assembly-line")]
    assert j(env.client.get("/api/doom/v1/messages"))["data"] == []


def test_stats_counters(env):
    env.adapter.solves = {1: [env.adapter.id_of("foundry-assembly-line")],
                          2: [env.adapter.id_of("foundry-assembly-line"),
                              env.adapter.id_of("foundry-half-built-bot")]}
    s = j(env.client.get("/api/doom/v1/stats"))["data"]
    assert s["total_solves"] == 3 and s["region_solves"]["foundry"] == 3
    assert s["first_blood"]["foundry-assembly-line"] == "team-one"


def test_unconfigured_event_does_not_crash(env):
    env.adapter._window = None
    s = j(env.client.get("/api/doom/v1/state"))
    assert s["configured"] is False
    assert j(env.client.get("/api/doom/v1/broadcasts"))["data"] == []


def test_seed_assigns_by_name_and_sample_matches_plan(env):
    board = env.svc.board()
    counts = {}
    for p in board["pool"]:
        if p["round_n"]:
            counts[p["round_n"]] = counts.get(p["round_n"], 0) + 1
    assert [counts[i] for i in range(1, 9)] == [10, 8, 7, 7, 6, 6, 5, 5]
    assert counts[9] == 6


def test_console_page_renders_for_admins_only(env):
    assert env.client.get("/admin/doom").status_code == 403
    env.adapter.user = dict(env.adapter.user, is_admin=True)
    r = env.client.get("/admin/doom")
    assert r.status_code == 200 and b"Doom Rounds Console" in r.data


def test_state_lists_released_ids_in_board_order(env):
    s = j(env.client.get("/api/doom/v1/state"))
    assert len(s["released_order"]) == 10
    listed_ids = {c["id"] for c in j(env.client.get("/api/v1/challenges"))["data"]}
    assert set(s["released_order"]) == listed_ids
    a, b = env.adapter.id_of("doomstadt-petition-box"), env.adapter.id_of("embassy-shell-company")
    env.svc.assign([{"challenge_id": b, "round_n": 1, "sort_order": 1},
                    {"challenge_id": a, "round_n": 1, "sort_order": 2}], "t")
    order = j(env.client.get("/api/doom/v1/state"))["released_order"]
    assert order.index(b) < order.index(a)
    assert len(json.dumps(s)) < 5000, "state must stay a small call"
