"""Rounds are data. No round count is hard-coded anywhere."""
from dataclasses import dataclass, replace
from datetime import datetime

from .clock import STORY_HOURS, as_utc

SCHEDULED, HELD, OPEN = "scheduled", "held", "open"
NORMAL, BONUS = "normal", "bonus"
DEFAULT_ROUND_COUNT = 8
DEFAULT_BONUS_HOUR = 22
TARGET_PER_ROUND = (10, 15)


@dataclass(frozen=True)
class Round:
    n: int
    name: str
    opens_at: datetime
    status: str = SCHEDULED
    kind: str = NORMAL


def default_rounds(window, count=DEFAULT_ROUND_COUNT, names=None):
    """N rounds spaced evenly across the event: round i opens at (i-1)/N."""
    count = max(1, int(count))
    step = window.duration / count
    out = []
    for i in range(count):
        nm = (names or {}).get(i + 1) or "Round %d" % (i + 1)
        out.append(Round(i + 1, nm, window.start + step * i))
    return out


def bonus_round(window, n, hour=DEFAULT_BONUS_HOUR, name="Hidden Set"):
    return Round(n, name, window.at_story_hour(hour), SCHEDULED, BONUS)


def is_open(rnd, now):
    if rnd.status == HELD:
        return False
    if rnd.status == OPEN:
        return True
    return as_utc(now) >= as_utc(rnd.opens_at)


def open_round_numbers(rounds, now):
    return {r.n for r in rounds if is_open(r, now)}


def phase(rounds, now):
    """Highest open normal round, or 0 before the first one."""
    ns = [r.n for r in rounds if r.kind == NORMAL and is_open(r, now)]
    return max(ns) if ns else 0


def next_phase_at(rounds, now):
    """Earliest future opening among rounds that are still scheduled."""
    future = [as_utc(r.opens_at) for r in rounds
              if r.status == SCHEDULED and as_utc(r.opens_at) > as_utc(now)]
    return min(future) if future else None


def normal_count(rounds):
    return sum(1 for r in rounds if r.kind == NORMAL)


def unlocked_challenge_ids(assignments, rounds, now):
    """assignments: {challenge_id: round_n}. Unassigned challenges never appear."""
    open_ns = open_round_numbers(rounds, now)
    return {cid for cid, n in assignments.items() if n in open_ns}


def gate_decision(challenge_id, assignments, rounds, now, window=None, *,
                  is_admin=False, gate_on=True):
    """Return (allowed, locked_until_incursion_hour, reason)."""
    if is_admin or not gate_on:
        return True, None, "bypass"
    n = assignments.get(challenge_id)
    if n is None:
        return False, None, "unassigned"
    by_n = {r.n: r for r in rounds}
    rnd = by_n.get(n)
    if rnd is None:
        return False, None, "unassigned"
    if is_open(rnd, now):
        return True, None, "open"
    if rnd.status == HELD:
        return False, None, "held"
    locked_until = None
    if window is not None:
        from .clock import incursion_hours_left
        locked_until = round(incursion_hours_left(window, rnd.opens_at), 3)
    return False, locked_until, "scheduled"


def released_by_region(assignments, region_of, rounds, now):
    """{region: {released, total}}. Bonus challenges stay out of both until open."""
    open_ns = open_round_numbers(rounds, now)
    kind_of = {r.n: r.kind for r in rounds}
    out = {}
    for cid, n in assignments.items():
        region = region_of.get(cid)
        if region is None or n not in kind_of:
            continue
        o = out.setdefault(region, {"released": 0, "total": 0})
        if kind_of[n] == BONUS and n not in open_ns:
            continue
        o["total"] += 1
        if n in open_ns:
            o["released"] += 1
    return out


def coverage_warnings(assignments, region_of, regions, rounds):
    """Warnings for the organiser console. Nothing here blocks a save."""
    warnings = []
    normal = sorted((r for r in rounds if r.kind == NORMAL), key=lambda r: r.n)
    if normal:
        first = normal[0].n
        covered = {region_of.get(c) for c, n in assignments.items() if n == first}
        for rid in regions:
            if rid not in covered:
                warnings.append({"level": "error", "code": "empty_first_round",
                                 "region": rid,
                                 "text": "%s has nothing in round %d, so it would be fully locked at the start." % (rid, first)})
    lo, hi = TARGET_PER_ROUND
    for r in normal:
        c = sum(1 for n in assignments.values() if n == r.n)
        if c < lo or c > hi:
            warnings.append({"level": "info", "code": "round_size", "round": r.n,
                             "text": "Round %d has %d challenges (target %d to %d)." % (r.n, c, lo, hi)})
    for rid in regions:
        if not any(region_of.get(c) == rid for c in assignments):
            warnings.append({"level": "error", "code": "empty_region", "region": rid,
                             "text": "%s has no challenges assigned in any round." % rid})
    return warnings
