from datetime import timedelta

import pytest

from ctfd_doom import rounds as rd
from ctfd_doom.clock import Window

from .fakes import END, START

W = Window(START, END)


@pytest.mark.parametrize("count", [8, 9, 10, 12])
def test_default_spacing_is_event_over_count(count):
    rs = rd.default_rounds(W, count)
    assert len(rs) == count
    step = (END - START) / count
    for i, r in enumerate(rs):
        assert r.opens_at == START + step * i


def test_eight_rounds_open_every_three_hours():
    rs = rd.default_rounds(W, 8)
    for h in range(0, 24, 3):
        now = START + timedelta(hours=h)
        assert rd.phase(rs, now) == h // 3 + 1
        assert rd.phase(rs, now - timedelta(seconds=1)) == h // 3


@pytest.mark.parametrize("count", [8, 9, 10])
def test_phase_release_for_n_rounds(count):
    rs = rd.default_rounds(W, count)
    step = (END - START) / count
    for i in range(count):
        assert rd.phase(rs, START + step * i) == i + 1
        assert rd.phase(rs, START + step * i - timedelta(seconds=1)) == i


def test_held_round_stays_closed_and_open_round_releases_early():
    rs = rd.default_rounds(W, 8)
    now = START + timedelta(hours=7)
    assert rd.phase(rs, now) == 3
    rs[2] = rd.Round(3, rs[2].name, rs[2].opens_at, rd.HELD)
    assert 3 not in rd.open_round_numbers(rs, now)
    assert rd.phase(rs, now) == 2
    rs[6] = rd.Round(7, rs[6].name, rs[6].opens_at, rd.OPEN)
    assert 7 in rd.open_round_numbers(rs, START)


def test_next_phase_at_ignores_held_rounds():
    rs = rd.default_rounds(W, 4)
    rs[1] = rd.Round(2, "x", rs[1].opens_at, rd.HELD)
    assert rd.next_phase_at(rs, START) == rs[2].opens_at


def test_bonus_round_opens_at_hour_22_by_default():
    b = rd.bonus_round(W, 9)
    assert b.kind == rd.BONUS
    assert not rd.is_open(b, START + timedelta(hours=21, minutes=59))
    assert rd.is_open(b, START + timedelta(hours=22))
    assert rd.phase([b], END) == 0, "bonus never counts as a normal phase"


def test_gate_decision():
    rs = rd.default_rounds(W, 8)
    asg = {10: 1, 11: 5}
    now = START + timedelta(hours=1)
    assert rd.gate_decision(10, asg, rs, now, W)[0] is True
    allowed, until, reason = rd.gate_decision(11, asg, rs, now, W)
    assert (allowed, reason) == (False, "scheduled")
    assert until == pytest.approx(4)  # round 5 opens at hour 12 => 4 incursion hours left
    assert rd.gate_decision(99, asg, rs, now, W)[2] == "unassigned"
    assert rd.gate_decision(11, asg, rs, now, W, is_admin=True)[0]
    assert rd.gate_decision(99, asg, rs, now, W, gate_on=False)[0]


def test_coverage_warns_when_a_region_is_locked_at_start():
    rs = rd.default_rounds(W, 8)
    region_of = {1: "a", 2: "b"}
    w = rd.coverage_warnings({1: 1, 2: 2}, region_of, ["a", "b"], rs)
    assert any(x["code"] == "empty_first_round" and x["region"] == "b" for x in w)
    assert not any(x["code"] == "empty_first_round" for x in
                   rd.coverage_warnings({1: 1, 2: 1}, region_of, ["a", "b"], rs))
