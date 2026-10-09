from datetime import timedelta

import pytest

from ctfd_doom import clock
from ctfd_doom.clock import Window

from .fakes import END, START

W = Window(START, END)

# hour: (incursion hours left, act)
BOUNDARIES = {0: (8, "I"), 3: (7, "I"), 6: (6, "II"), 9: (5, "II"), 12: (4, "IV"),
              15: (3, "IV"), 18: (2, "IV"), 21: (1, "IV"), 24: (0, "END")}


@pytest.mark.parametrize("hour,expected", BOUNDARIES.items())
def test_incursion_clock_at_each_boundary(hour, expected):
    now = START + timedelta(hours=hour)
    assert clock.incursion_hours_left(W, now) == pytest.approx(expected[0])
    assert clock.act_for(W, now) == expected[1]


def test_before_start_and_after_end():
    assert clock.act_for(W, START - timedelta(minutes=1)) == "PRE"
    assert clock.incursion_hours_left(W, START - timedelta(hours=5)) == 8
    assert clock.incursion_hours_left(W, END + timedelta(hours=5)) == 0
    assert clock.act_for(W, END + timedelta(hours=1)) == "END"


def test_just_before_a_boundary_is_still_the_old_act():
    assert clock.act_for(W, START + timedelta(hours=6) - timedelta(seconds=1)) == "I"
    assert clock.act_for(W, START + timedelta(hours=12) - timedelta(seconds=1)) == "II"


def test_oath_beat_is_a_window_inside_act_iv():
    assert not clock.oath_beat(W, START + timedelta(hours=11))
    assert clock.oath_beat(W, START + timedelta(hours=12))
    assert not clock.oath_beat(W, START + timedelta(hours=15))


def test_story_scales_with_event_length():
    short = Window(START, START + timedelta(hours=12))
    assert clock.act_for(short, START + timedelta(hours=2)) == "I"
    assert clock.act_for(short, START + timedelta(hours=3)) == "II"
    assert clock.act_for(short, START + timedelta(hours=6)) == "IV"
    assert clock.story_hour(short, START + timedelta(hours=6)) == pytest.approx(12)


def test_broadcast_due_at_each_hour():
    for h in clock.BROADCAST_HOURS:
        assert clock.broadcast_due(W, START + timedelta(hours=h), h)
        if h:
            assert not clock.broadcast_due(W, START + timedelta(hours=h) - timedelta(seconds=1), h)
    assert not clock.broadcast_due(W, START - timedelta(hours=1), 0)


def test_offset_and_pause():
    real = START + timedelta(hours=1)
    assert clock.effective_now(real, 120) == START + timedelta(hours=3)
    assert clock.effective_now(real, 120, paused_at=START + timedelta(hours=2)) == START + timedelta(hours=2)
