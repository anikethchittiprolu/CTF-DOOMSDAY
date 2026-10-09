// Pure time and round maths. The server is authoritative; the client only displays,
// and the mock uses the same functions to stand in for the server.
export const INCURSION_HOURS = 8;
export const STORY_HOURS = 24;
export const BROADCAST_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export const fraction = (start, end, now) => {
  const total = end - start;
  return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - start) / total));
};
export const storyHour = (start, end, now) => fraction(start, end, now) * STORY_HOURS;
export const incursionLeft = (start, end, now) => INCURSION_HOURS - INCURSION_HOURS * fraction(start, end, now);

export function actFor(start, end, now) {
  if (now < start) return 'PRE';
  if (now >= end) return 'END';
  const h = storyHour(start, end, now);
  return h < 6 ? 'I' : h < 12 ? 'II' : 'IV';
}

export function defaultRounds(start, end, count = 8) {
  const step = (end - start) / count;
  return Array.from({ length: count }, (_, i) => ({ n: i + 1, opensAt: start + step * i, status: 'scheduled', kind: 'normal' }));
}
export const isOpen = (r, now) => r.status === 'held' ? false : r.status === 'open' ? true : now >= r.opensAt;

/** "07:42:10" style, never negative. */
export function formatLeft(hoursLeft) {
  const s = Math.max(0, Math.round(hoursLeft * 3600));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Jitter so every team does not refresh at the same second on a release. */
export const jitter = (maxMs, rnd = Math.random) => Math.floor(rnd() * maxMs);

/** Poll delay with exponential backoff and jitter. */
export function backoff(baseMs, failures, rnd = Math.random, capMs = 5 * 60 * 1000) {
  const d = Math.min(capMs, baseMs * 2 ** Math.min(failures, 6));
  return Math.round(d * (0.8 + rnd() * 0.4));
}
