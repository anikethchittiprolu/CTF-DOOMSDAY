// An in-browser stand-in for CTFd + ctfd-doom, so the whole game runs with no server.
// Only included in dev and test builds (see main.js); the production theme never ships it.
import regionsJson from '../../../content/regions.json';
import broadcastsJson from '../../../content/broadcasts.json';
import messagesJson from '../../../content/messages.json';
import phasesJson from '../../../content/phases.json';
import { installMock } from '../net.js';
import { config } from '../config.js';
import * as K from '../lib/clock.js';

const chalFiles = import.meta.glob('../../../content/challenges/*.json', { eager: true, import: 'default' });
const codexFiles = import.meta.glob('../../../content/codex/*.md', { eager: true, query: '?raw', import: 'default' });

const FLAG = 'MVSR{demo}';
const TEAM = { id: 42, name: 'Iron Ten' };
const OTHERS = ['Latverian Lions', 'Null Sovereign', 'Doombot Fan Club', 'Castle Crashers', 'Pwn Mountain', 'Rune Riders',
  'Time Variance', 'Embassy Row', 'Hex Monks', 'Cipher Wheel', 'Stack Smashers'];
const SESSION_KEY = 'doom.mock.v1';

const regions = regionsJson.regions;
const catToRegion = Object.fromEntries(regions.map((r) => [r.category, r.id]));

// ---- build the challenge table from content --------------------------------
const chals = [];
let nextId = 1;
for (const f of Object.values(chalFiles)) {
  if (f.bonus) {
    for (const b of f.bonus) chals.push({ id: nextId++, key: b.key, name: b.name, region: b.region, category: regions.find((r) => r.id === b.region).category, value: b.value, tier: b.tier, round: 'bonus' });
    continue;
  }
  for (const c of f.challenges) chals.push({ id: nextId++, key: c.key, name: c.name, region: f.region, category: f.category, value: c.value, tier: c.tier, round: c.round });
}
const codexByKey = {};
for (const [path, raw] of Object.entries(codexFiles)) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s*/, 2)));
  codexByKey[meta.challenge] = { ...meta, text: m[2].trim().replace(/\n/g, ' ') };
}
const byId = Object.fromEntries(chals.map((c) => [c.id, c]));

// ---- mutable server state ---------------------------------------------------
const q = config.params;
const DAY = 24 * 3600 * 1000;
const fresh = () => ({
  baseReal: Date.now(), baseHour: Number(q.get('hour') ?? 0.05), warp: Number(q.get('warp') ?? 1),
  rounds: 8, held: [], released: [], offsetMs: 0, gate: q.get('gate') !== '0',
  solved: {}, attempts: {}, hints: [], pointsSpent: 0, read: [], snap: {}, failNext: 0, latency: Number(q.get('latency') ?? 0),
});
let S;
try { S = q.has('reset') ? fresh() : { ...fresh(), ...JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') }; } catch { S = fresh(); }
const save = () => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(S)); } catch { /* ignore */ } };

const EVENT_START = Date.UTC(2026, 10, 1, 6, 0, 0);
const EVENT_END = EVENT_START + DAY;
const nowMs = () => EVENT_START + (S.baseHour * 3600 * 1000) + (Date.now() - S.baseReal) * S.warp + S.offsetMs;
const rounds = () => {
  const rs = K.defaultRounds(EVENT_START, EVENT_END, S.rounds);
  rs.forEach((r) => { if (S.held.includes(r.n)) r.status = 'held'; if (S.released.includes(r.n)) r.status = 'open'; });
  rs.push({ n: S.rounds + 1, opensAt: EVENT_START + DAY * 22 / 24, status: 'scheduled', kind: 'bonus' });
  return rs;
};
const roundOf = (c) => (c.round === 'bonus' ? S.rounds + 1 : Math.min(c.round, S.rounds));
const isReleased = (c, now = nowMs()) => {
  if (!S.gate) return true;
  const r = rounds().find((x) => x.n === roundOf(c));
  return !!r && K.isOpen(r, now);
};
const released = () => chals.filter((c) => isReleased(c));

// Other teams' solve counts grow with the clock, deterministic.
function othersSolves(now) {
  const h = K.storyHour(EVENT_START, EVENT_END, now);
  return OTHERS.map((name, i) => ({ name, solves: Math.min(released().length, Math.floor(h * (2.2 - i * 0.12) + (i % 3))) }));
}
const myScore = () => Object.keys(S.solved).reduce((a, id) => a + byId[id].value, 0) - S.pointsSpent;
const standings = () => {
  const rows = othersSolves(nowMs()).map((o) => ({ name: o.name, score: o.solves * 85 })).concat([{ name: TEAM.name, score: myScore() }]);
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, account_id: r.name === TEAM.name ? TEAM.id : 100 + i, pos: i + 1 }));
};

const ok = (data, extra) => ({ status: 200, json: { success: true, data, ...extra } });
const err = (status, errors, extra) => ({ status, json: { success: false, errors, ...extra } });

// ---- doom endpoints -------------------------------------------------------
function stateOut() {
  const now = nowMs();
  const rs = rounds();
  const rel = {};
  const order = released().filter((c) => c.round !== 'bonus' || isReleased(c)).map((c) => c.id);
  for (const c of chals) {
    const r = rel[c.region] ??= { released: 0, total: 0 };
    if (c.round === 'bonus' && !isReleased(c)) continue;
    r.total++;
    if (isReleased(c)) r.released++;
  }
  const open = rs.filter((r) => r.kind === 'normal' && K.isOpen(r, now)).map((r) => r.n);
  const nextAt = rs.filter((r) => r.status === 'scheduled' && r.opensAt > now).map((r) => r.opensAt).sort((a, b) => a - b)[0];
  return {
    configured: true, now: new Date(now).toISOString(), event_start: new Date(EVENT_START).toISOString(), event_end: new Date(EVENT_END).toISOString(),
    incursion_hours_left: K.incursionLeft(EVENT_START, EVENT_END, now), incursion: K.fraction(EVENT_START, EVENT_END, now),
    story_hour: K.storyHour(EVENT_START, EVENT_END, now), act: K.actFor(EVENT_START, EVENT_END, now),
    oath_beat: K.storyHour(EVENT_START, EVENT_END, now) >= 12 && K.storyHour(EVENT_START, EVENT_END, now) < 15,
    phase: open.length ? Math.max(...open) : 0, rounds_total: S.rounds, next_phase_at: nextAt ? new Date(nextAt).toISOString() : null,
    released_by_region: rel, released_order: order, bonus_revealed: isReleased(chals.find((c) => c.round === 'bonus')),
    gate_on: S.gate, paused: false, team_solves: Object.keys(S.solved).length,
  };
}
const statsNow = () => {
  const others = othersSolves(nowMs());
  const regionSolves = {};
  for (const id of Object.keys(S.solved)) regionSolves[byId[id].region] = (regionSolves[byId[id].region] ?? 0) + 1;
  return { teams: OTHERS.length + 1, total_solves: others.reduce((a, o) => a + o.solves, 0) + Object.keys(S.solved).length, region_solves: regionSolves,
    top_team: standings()[0].name, top10: standings().slice(0, 10).map((s) => ({ account_id: s.account_id, name: s.name, score: s.score })),
    first_blood: {}, incursion_hours_left: K.incursionLeft(EVENT_START, EVENT_END, nowMs()) };
};
function render(text, st, hour) {
  return text.replace(/\{([a-z_]+)(?::([\w-]+))?\}/g, (_, n, a) => ({
    teams: st.teams, total_solves: st.total_solves, top_team: st.top_team || 'no one yet',
    incursion_hours_left: K.INCURSION_HOURS - hour / 3, region_solves: st.region_solves[a] ?? 0, first_blood: 'no one yet',
  }[n] ?? '-'));
}
function broadcastsOut() {
  const now = nowMs();
  const h = K.storyHour(EVENT_START, EVENT_END, now);
  const st = statsNow();
  const out = [];
  for (const b of broadcastsJson.broadcasts) {
    const due = b.hour >= 24 ? now >= EVENT_END : h >= b.hour;
    if (!due) continue;
    if (!S.snap[b.key]) {
      const spt = st.total_solves / Math.max(1, st.teams);
      const v = spt >= broadcastsJson.high_if_solves_per_team ? 'high' : spt >= 1 ? 'mid' : 'low';
      S.snap[b.key] = { text: render(b.variants[v], st, b.hour), subtitle: render(b.subtitle, st, b.hour), at: new Date(now).toISOString() };
      save();
    }
    out.push({ key: b.key, hour: b.hour, title: b.title, text: S.snap[b.key].text, subtitle: S.snap[b.key].subtitle, rendered_at: S.snap[b.key].at });
  }
  return out;
}
const solvedKeys = () => new Set(Object.keys(S.solved).map((id) => byId[id].key));
function codexOut() {
  const solved = solvedKeys();
  const unlocked = [], locked = [];
  Object.keys(codexByKey).sort().forEach((k, i) => {
    const c = chals.find((x) => x.key === k);
    if (solved.has(k)) unlocked.push({ id: k, title: c.name, region: c.region, kind: codexByKey[k].kind, tier: c.tier, text: codexByKey[k].text, locked: false });
    else if (c.round !== 'bonus' || isReleased(c)) locked.push({ id: 'locked-' + String(i).padStart(2, '0'), region: c.region, tier: c.tier, locked: true });
  });
  return { unlocked, locked };
}
function messagesOut() {
  const solved = solvedKeys();
  const act = K.actFor(EVENT_START, EVENT_END, nowMs());
  const order = { PRE: 0, I: 1, II: 2, IV: 3, END: 4 };
  const relByRegion = {};
  for (const c of released()) (relByRegion[c.region] ??= []).push(c.key);
  const cleared = Object.values(relByRegion).some((keys) => keys.length >= 2 && keys.every((k) => solved.has(k)));
  return messagesJson.messages.filter((m) => {
    if (m.requires_challenge && !solved.has(m.requires_challenge)) return false;
    const t = m.trigger;
    return t.type === 'first_solve' ? solved.size >= 1 : t.type === 'solves' ? solved.size >= t.n : t.type === 'region_cleared' ? cleared
      : t.type === 'act' ? order[act] >= order[t.act] : t.type === 'challenge' ? solved.has(t.challenge) : false;
  }).map((m) => ({ id: m.id, from: m.from, subject: m.subject, text: m.text, read: S.read.includes(m.id) }));
}

// ---- CTFd endpoints ---------------------------------------------------------
const hintsFor = (c) => [{ id: c.id * 10 + 1, cost: Math.max(5, c.value / 10) }, { id: c.id * 10 + 2, cost: Math.max(10, c.value / 5) }];
const hintText = (id) => (id % 10 === 1 ? 'Boris: begin with the fiction, then find the plain requirement in the task.' : 'Boris: this is a placeholder task. The flag is ' + FLAG + '.');
const attemptsOf = (id) => S.attempts[id] ?? 0;

function listOut() {
  return released().map((c) => ({ id: c.id, type: 'standard', name: c.name, value: c.value, solves: 1 + (c.id % 7), solved_by_me: !!S.solved[c.id],
    category: c.category, tags: [], template: '', script: '' }));
}
function singleOut(id) {
  const c = byId[id];
  if (!c) return err(404, { challenge: 'not found' });
  if (!isReleased(c)) {
    const r = rounds().find((x) => x.n === roundOf(c));
    return err(403, { challenge: 'This challenge is not open yet.' }, { locked_until: Math.round(K.incursionLeft(EVENT_START, EVENT_END, r.opensAt) * 1000) / 1000 });
  }
  return ok({ id: c.id, name: c.name, value: c.value, category: c.category, state: 'visible', type: 'standard', max_attempts: 5, attempts: attemptsOf(id),
    solves: 1 + (id % 7), solved_by_me: !!S.solved[id], next_id: null, connection_info: c.region === 'doomstadt' ? 'https://petition.doomstadt.lv:8443' : null,
    description: `Placeholder challenge in ${c.category}.\n\nSubmit the flag **${FLAG}** to continue.\n\nThis stands in for a real task until the organisers replace it.`,
    files: c.id % 5 === 0 ? ['/files/demo/notes.txt'] : [], tags: [], hints: hintsFor(c).map((h) => ({ id: h.id, cost: h.cost })) });
}
function attemptOut(body) {
  const id = Number(body.challenge_id);
  const c = byId[id];
  if (!c || !isReleased(c)) return err(403, { challenge: 'locked' }, { locked_until: 0 });
  if (S.solved[id]) return ok({ status: 'already_solved', message: 'You already solved this' });
  if (attemptsOf(id) >= 5) return { status: 403, json: { success: false, data: { status: 'incorrect', message: 'You have 0 tries remaining' } } };
  S.attempts[id] = attemptsOf(id) + 1;
  if (String(body.submission).trim() === FLAG) { S.solved[id] = nowMs(); save(); return ok({ status: 'correct', message: 'Correct' }); }
  save();
  return ok({ status: 'incorrect', message: `Incorrect. You have ${5 - attemptsOf(id)} tries remaining` });
}

async function handle(method, path, body) {
  if (S.latency) await new Promise((r) => setTimeout(r, S.latency));
  if (S.failNext > 0 && method === 'POST') { S.failNext--; return { networkError: true }; }
  if (S.failNextGet > 0 && method === 'GET') { S.failNextGet--; return { networkError: true }; }
  const url = new URL(path, 'http://x');
  const p = url.pathname;
  let m;
  if (p === '/api/doom/v1/state') return { status: 200, json: stateOut() };
  if (p === '/api/doom/v1/broadcasts') return ok(broadcastsOut());
  if (p === '/api/doom/v1/codex') return ok(codexOut());
  if (p === '/api/doom/v1/messages') return ok(messagesOut());
  if (p === '/api/doom/v1/stats') return ok(statsNow());
  if ((m = p.match(/^\/api\/doom\/v1\/messages\/([\w-]+)\/read$/))) { if (!S.read.includes(m[1])) S.read.push(m[1]); save(); return ok({}); }
  if (p === '/api/v1/challenges' && method === 'GET') return ok(listOut());
  if (p === '/api/v1/challenges/attempt') return attemptOut(body);
  if ((m = p.match(/^\/api\/v1\/challenges\/(\d+)$/))) return singleOut(Number(m[1]));
  if ((m = p.match(/^\/api\/v1\/hints\/(\d+)$/))) {
    const id = Number(m[1]);
    return S.hints.includes(id) ? ok({ id, content: hintText(id), cost: 0 }) : ok({ id, cost: hintsFor(byId[Math.floor(id / 10)])[id % 10 - 1].cost });
  }
  if (p === '/api/v1/unlocks') {
    const id = Number(body.target);
    const cost = hintsFor(byId[Math.floor(id / 10)])[id % 10 - 1].cost;
    if (myScore() < cost) return err(400, { score: 'You do not have enough points to unlock this hint' });
    if (!S.hints.includes(id)) { S.hints.push(id); S.pointsSpent += cost; save(); }
    return ok({ target: id });
  }
  if (p === '/api/v1/teams/me' || p === '/api/v1/users/me') {
    const st = standings();
    const me = st.find((s) => s.account_id === TEAM.id);
    return ok({ id: TEAM.id, name: TEAM.name, score: me.score, place: me.pos });
  }
  return err(404, { path: 'not found' });
}

installMock(handle);

// Test hooks.
window.__mock = {
  setHour(h) { S.baseHour = h; S.baseReal = Date.now(); S.offsetMs = 0; save(); },
  setRounds(n) { S.rounds = n; save(); },
  hold(n) { S.held.push(n); save(); },
  release(n) { S.released.push(n); save(); },
  failNext(n = 1) { S.failNext = n; },
  failNextGet(n = 1) { S.failNextGet = n; },
  setLatency(ms) { S.latency = ms; },
  solve(key) { const c = chals.find((x) => x.key === key); S.solved[c.id] = nowMs(); save(); },
  attempts: (key) => attemptsOf(chals.find((x) => x.key === key).id),
  reset() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } S = fresh(); },
  chals,
  FLAG,
};
export const mockReady = true;
