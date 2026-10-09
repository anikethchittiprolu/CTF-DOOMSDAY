"""The one clock function. Everything time-based in the plugin goes through here.

The event runs from CTFd's `start` to `end`. Story time is the event mapped
onto a 24-hour reference, so a 12-hour practice event still plays all four acts.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

INCURSION_HOURS = 8.0
STORY_HOURS = 24.0
BROADCAST_HOURS = (0, 3, 6, 9, 12, 15, 18, 21, 24)


def utcnow():
    return datetime.now(timezone.utc)


def as_utc(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@dataclass(frozen=True)
class Window:
    start: datetime
    end: datetime

    @property
    def duration(self):
        return self.end - self.start

    def at_story_hour(self, hour):
        return self.start + self.duration * (hour / STORY_HOURS)


def effective_now(real_now, offset_minutes=0.0, paused_at=None):
    """Event time. `paused_at` freezes it; the offset shifts it for testing."""
    if paused_at is not None:
        return as_utc(paused_at)
    return as_utc(real_now) + timedelta(minutes=float(offset_minutes or 0))


def fraction(window, now):
    total = window.duration.total_seconds()
    if total <= 0:
        return 1.0
    f = (as_utc(now) - window.start).total_seconds() / total
    return min(1.0, max(0.0, f))


def story_hour(window, now):
    return fraction(window, now) * STORY_HOURS


def incursion_hours_left(window, now):
    return INCURSION_HOURS - INCURSION_HOURS * fraction(window, now)


def incursion_level(window, now):
    """0 at the start, 1 at the end. Drives sky cracks, fog and music."""
    return fraction(window, now)


def act_for(window, now):
    """PRE, I, II, IV or END. Act III is a story beat inside IV (see oath_beat)."""
    now = as_utc(now)
    if now < window.start:
        return "PRE"
    if now >= window.end:
        return "END"
    h = story_hour(window, now)
    if h < 6:
        return "I"
    if h < 12:
        return "II"
    return "IV"


def oath_beat(window, now):
    """Act III is a story beat only in v1: Doom's offer and Banner's reveal."""
    if act_for(window, now) != "IV":
        return False
    return 12 <= story_hour(window, now) < 15


def incursion_hours_at(window, when):
    return incursion_hours_left(window, when)


def broadcast_due(window, now, hour):
    """Broadcast h{hour} is readable once the clock passes it. h24 is at the end."""
    if as_utc(now) < window.start:
        return False
    if hour >= STORY_HOURS:
        return as_utc(now) >= window.end
    return story_hour(window, now) >= hour
