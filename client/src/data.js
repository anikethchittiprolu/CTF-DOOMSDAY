import { createStore, emit } from './lib/bus.js';
import { backoff, jitter } from './lib/clock.js';
import { config } from './config.js';
import { net } from './net.js';
import { prefs, setPref } from './lib/prefs.js';
import * as ctfd from './api/ctfd.js';
import * as doom from './api/doom.js';
import { regionByCategory, regions } from './lib/dialogue.js';
import { tierForValue } from './lib/tiers.js';

export const store = createStore({
  ready: false, state: null, stateAt: 0, challenges: [], team: null, codex: { unlocked: [], locked: [] },
  messages: [], broadcasts: [], stats: null, attempts: {}, syncing: false,
});
const get = store.get;

// ---- selectors ---------------------------------------------------------------
export const regionOf = (c) => regionByCategory[c.category]?.id ?? null;
export function challengesIn(regionId) {
  const order = get().state?.released_order ?? [];
  const idx = (c) => { const i = order.indexOf(c.id); return i < 0 ? 1e6 + c.id : i; };
  return get().challenges.filter((c) => regionOf(c) === regionId).sort((a, b) => idx(a) - idx(b));
}
export function regionStatus(id) {
  const rel = get().state?.released_by_region?.[id] ?? { released: 0, total: 0 };
  const list = get().challenges.filter((c) => regionOf(c) === id);
  const released = Math.max(rel.released, list.length);
  const total = Math.max(rel.total, released);
  const solved = list.filter((c) => c.solved_by_me).length;
  const seen = prefs().seenReleased?.[id] ?? 0;
  return { id, released, total, solved, cleared: total > 0 && solved >= total, fresh: released > seen && released > 0 && seen > 0 };
}
export function markRegionSeen(id) {
  const s = regionStatus(id);
  setPref('seenReleased', { ...(prefs().seenReleased ?? {}), [id]: s.released });
}
export const accountKey = () => String(config.init?.teamId ?? config.init?.userId ?? 'mock');

// Clock interpolation: the HUD ticks locally between polls, so it needs no extra calls.
export function incursionLeftNow() {
  const { state, stateAt } = get();
  if (!state?.configured) return 8;
  if (state.paused) return state.incursion_hours_left;
  const hours = (Date.parse(state.event_end) - Date.parse(state.event_start)) / 3600000;
  const rate = hours > 0 ? 8 / hours : 0; // incursion hours per real hour
  const warp = Number(config.params.get('warp') ?? 1);
  return Math.max(0, state.incursion_hours_left - ((performance.now() - stateAt) / 3600000) * rate * (config.mock ? warp : 1));
}

// ---- loaders -----------------------------------------------------------------
const quiet = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

export async function refreshChallenges() {
  const list = await ctfd.listChallenges();
  store.set({ challenges: list });
  return list;
}
export async function refreshTeam() { store.set({ team: (await quiet(() => ctfd.me(), null)) ?? get().team }); }
export async function refreshCodex() { store.set({ codex: await quiet(() => doom.codex(), get().codex) }); }
export async function refreshStats() { store.set({ stats: await quiet(() => doom.stats(), get().stats) }); }

export async function refreshMessages() {
  const prev = new Set(get().messages.map((m) => m.id));
  const msgs = await quiet(() => doom.messages(), null);
  if (!msgs) return;
  store.set({ messages: msgs });
  const fresh = msgs.filter((m) => !prev.has(m.id) && !m.read);
  if (get().ready && fresh.length) emit('new-messages', fresh);
}
export async function refreshBroadcasts() {
  const prev = new Set(get().broadcasts.map((b) => b.key));
  const list = await quiet(() => doom.broadcasts(), null);
  if (!list) return;
  store.set({ broadcasts: list });
  const fresh = list.filter((b) => !prev.has(b.key));
  if (get().ready && fresh.length) emit('new-broadcasts', fresh);
}

let releaseTimer = null;
function applyState(s) {
  const prev = get().state;
  store.set({ state: s, stateAt: performance.now() });
  if (!s.configured) return;
  if (prev && s.phase > prev.phase) emit('release', { phase: s.phase });
  if (prev && s.act !== prev.act) emit('act', { act: s.act });
  if (prev && prev.released_order?.length !== s.released_order?.length) scheduleChallengeRefresh();
  // Wake just after the next release, spread by 0..20 s so the server is not hit at once.
  clearTimeout(releaseTimer);
  if (s.next_phase_at && !s.paused) {
    const warp = config.mock ? Number(config.params.get('warp') ?? 1) : 1;
    const wait = (Date.parse(s.next_phase_at) - Date.parse(s.now)) / warp + jitter(config.releaseJitterMs);
    if (wait > 0 && wait < 2 ** 31 - 1) releaseTimer = setTimeout(() => { pollState(); }, wait);
  }
}
let challengeTimer = null;
function scheduleChallengeRefresh() {
  clearTimeout(challengeTimer);
  challengeTimer = setTimeout(() => refreshChallenges().catch(() => {}), jitter(config.releaseJitterMs));
}

let failures = 0, stateTimer = null, slowCount = 0;
export async function pollState() {
  clearTimeout(stateTimer);
  try {
    const s = await doom.state();
    failures = 0; applyState(s);
    if (++slowCount % 4 === 0) { refreshMessages(); refreshBroadcasts(); refreshTeam(); }
  } catch { failures++; }
  if (!document.hidden) stateTimer = setTimeout(pollState, backoff(config.statePollMs, failures));
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && get().ready) pollState(); });
window.addEventListener('online', () => { if (get().ready) pollState(); });
export const pollNow = () => { failures = 0; return pollState(); };

/** First load. Resolves when enough data exists to draw the map; throws if the server is unreachable. */
export async function load() {
  store.set({ syncing: true });
  const [state, chals] = await Promise.all([quiet(doom.state, null), quiet(ctfd.listChallenges, null)]);
  if (!state && !chals) { store.set({ syncing: false }); throw new Error('unreachable'); }
  if (state) applyState(state);
  if (chals) store.set({ challenges: chals });
  else await refreshChallenges().catch(() => {});
  await Promise.all([refreshTeam(), refreshCodex(), refreshMessages(), refreshBroadcasts(), refreshStats()]);
  store.set({ ready: true, syncing: false });
  stateTimer = setTimeout(pollState, backoff(config.statePollMs, 0));
}

export async function afterSolve() {
  await Promise.all([refreshChallenges().catch(() => {}), doom.state().then(applyState).catch(() => {}), refreshTeam(), refreshCodex(), refreshStats()]);
  await refreshMessages();
}

// attempts we have seen for each challenge this session (the server count wins when present)
export function noteAttempts(id, n) { store.set((s) => ({ attempts: { ...s.attempts, [id]: n } })); }
export const tierOf = (c) => tierForValue(c.value);
export { regions, net };
