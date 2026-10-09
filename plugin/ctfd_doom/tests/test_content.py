import pytest

from ctfd_doom import content as ct
from ctfd_doom import messages as msg


def test_all_ten_regions_and_54_challenges(content):
    assert len(content.regions) == 10
    assert len(content.challenges) == 54
    assert len(content.bonus) == 6


def test_sample_schedule_matches_the_plan_table(content):
    per_round = {}
    for c in content.challenges:
        per_round[c["round"]] = per_round.get(c["round"], 0) + 1
    assert [per_round[i] for i in range(1, 9)] == [10, 8, 7, 7, 6, 6, 5, 5]
    per_region = {}
    for c in content.challenges:
        per_region[c["region"]] = per_region.get(c["region"], 0) + 1
    assert per_region == {"doomstadt": 7, "embassy": 5, "foundry": 8, "archives": 7,
                          "haasenstadt": 5, "monastery": 4, "wundagore": 5, "baxter": 4,
                          "timeplatform": 4, "citadel": 5}


def test_every_region_has_a_round_one_challenge(content):
    assert {c["region"] for c in content.challenges if c["round"] == 1} == set(content.region_ids)


def test_every_challenge_has_codex(content):
    for c in content.challenges + content.bonus:
        assert c["key"] in content.codex


def test_render_all_placeholders():
    stats = {"teams": 40, "total_solves": 7, "top_team": "Iron Ten", "incursion_hours_left": 7,
             "region_solves": {"foundry": 3}, "first_blood": {"foundry-assembly-line": "Zed"}}
    out = ct.render("{teams}|{total_solves}|{top_team}|{incursion_hours_left}|{region_solves:foundry}|"
                    "{first_blood:foundry-assembly-line}|{region_solves:nowhere}|{bogus}", stats)
    assert out == "40|7|Iron Ten|7|3|Zed|0|-"


def test_variants_follow_solve_rate(content):
    b = content.broadcast("h3")
    low = ct.pick_variant(b, {"teams": 10, "total_solves": 2})
    high = ct.pick_variant(b, {"teams": 10, "total_solves": 40})
    assert low != high


def test_messages_thresholds(content):
    m = content.messages
    assert msg.earned(m, set(), {}, None, "I") == []
    ids = lambda s, tot=None, act="I": {x["id"] for x in msg.earned(m, s, tot or {}, None, act)}
    assert "shuri-1" not in ids({"doomstadt-petition-box"}), "needs the Foundry flag"
    assert "shuri-1" in ids({"foundry-assembly-line"})
    assert "shuri-2" not in ids({"a", "b"}) and "shuri-2" in ids({"a", "b", "c"})
    assert "shuri-4" not in ids(set(), act="I") and "shuri-4" in ids(set(), act="II")
    assert "shuri-5" in ids(set(), act="IV")
    tot = {"foundry": ["foundry-assembly-line", "foundry-half-built-bot"]}
    assert "shuri-3" in ids(set(tot["foundry"]), tot)
    assert "shuri-3" not in ids({"foundry-assembly-line"}, tot)
