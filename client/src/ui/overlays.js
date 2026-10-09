import { store, refreshStats, refreshMessages, refreshCodex, refreshBroadcasts } from '../data.js';
import { openPanel } from './panel.js';
import { esc } from '../lib/text.js';
import { tierById, tierBadge } from '../lib/tiers.js';
import { regions, regionById, speakerName, pick } from '../lib/dialogue.js';
import { portrait } from './portraits.js';
import { readMessage } from '../api/doom.js';
import { prefs, setPref, prefersReducedMotion } from '../lib/prefs.js';
import { audio } from '../audio/audio.js';
import { speak } from './dialogue.js';
import { seenBroadcast } from './shell.js';

const KIND = { 'state-document': 'State document', grimoire: 'Grimoire page', intercept: 'Resistance intercept', diary: 'Diary leaf' };

// ---- Codex -------------------------------------------------------------------
export function openCodex(tab = 'entries', { playBroadcast } = {}) {
  const p = openPanel({ title: 'Codex of Doom', cls: 'codex' });
  let region = '';
  const draw = () => {
    const { codex, broadcasts } = store.get();
    const tabs = `<div class="tabs" role="tablist"><button class="tab" role="tab" data-tab="entries" aria-selected="${tab === 'entries'}" data-autofocus>Entries (${codex.unlocked.length}/${codex.unlocked.length + codex.locked.length})</button><button class="tab" role="tab" data-tab="broadcasts" aria-selected="${tab === 'broadcasts'}">Broadcasts (${broadcasts.length})</button></div>`;
    let body = '';
    if (tab === 'entries') {
      const sel = `<label class="dim" style="font-size:.8em">Region <select id="cx-region"><option value="">All</option>${regions.map((r) => `<option value="${r.id}" ${region === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>`;
      const un = codex.unlocked.filter((e) => !region || e.region === region);
      const lk = codex.locked.filter((e) => !region || e.region === region);
      body = sel + '<div style="margin-top:10px">' +
        un.map((e) => `<article class="codex-entry"><div class="kind">${esc(KIND[e.kind] ?? e.kind)} &middot; ${esc(regionById[e.region]?.name ?? '')}</div><h3>${esc(e.title)}</h3><p style="margin:0">${esc(e.text)}</p></article>`).join('') +
        lk.map((e) => `<article class="codex-entry locked"><div class="kind">Sealed &middot; ${esc(regionById[e.region]?.name ?? '')} &middot; ${esc(tierById(e.tier)?.label ?? '')}</div><p style="margin:0">Solve a task in this region to unlock this entry.</p></article>`).join('') + '</div>';
      if (!un.length && !lk.length) body += '<p class="dim">Nothing here yet.</p>';
    } else {
      body = broadcasts.length ? `<div class="list">${broadcasts.map((b) => `<div class="codex-entry"><div class="kind">Hour ${b.hour} &middot; ${esc(b.title)} ${seenBroadcast(b.key) ? '' : '&middot; <b style="color:var(--amber)">new</b>'}</div><p style="margin:6px 0">${esc(b.text)}</p><button class="btn small" data-play="${esc(b.key)}">Play</button></div>`).join('')}</div>` : '<p class="dim">Doom has not spoken yet.</p>';
    }
    p.body.innerHTML = tabs + body;
  };
  draw();
  p.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); p.body.querySelector('[data-tab][aria-selected="true"]')?.focus(); }
    const pl = e.target.closest('[data-play]'); if (pl) { p.close(); playBroadcast?.(pl.dataset.play); }
  });
  p.body.addEventListener('change', (e) => { if (e.target.id === 'cx-region') { region = e.target.value; draw(); p.body.querySelector('#cx-region')?.focus(); } });
  refreshCodex().then(draw); refreshBroadcasts().then(draw);
  const line = pick('codex_read'); if (line) speak(line, 5000);
}

// ---- Comms -------------------------------------------------------------------
export function openComms() {
  const p = openPanel({ title: 'Comms', cls: 'comms' });
  let openId = null;
  const draw = () => {
    const { messages } = store.get();
    if (openId) {
      const m = messages.find((x) => x.id === openId);
      p.body.innerHTML = `<button class="btn small" data-back data-autofocus>&larr; All messages</button><div class="npc" style="margin-top:10px"><div class="face">${portrait(m.from)}</div><div><div class="who">${esc(speakerName(m.from))}</div><b>${esc(m.subject)}</b></div></div><p>${esc(m.text)}</p>`;
      return;
    }
    p.body.innerHTML = messages.length ? `<div class="list">${[...messages].reverse().map((m, i) => `<button class="row ${m.read ? '' : 'unread'}" data-msg="${esc(m.id)}" ${i === 0 ? 'data-autofocus' : ''}><span style="width:40px;height:40px;flex:none">${portrait(m.from)}</span><span class="grow"><b>${esc(speakerName(m.from))}</b> &middot; ${esc(m.subject)}</span>${m.read ? '' : '<span style="color:var(--red)">&bull;</span>'}</button>`).join('')}</div>` : '<p class="dim">No messages yet. Messages arrive as you solve tasks and as the story advances.</p>';
  };
  draw();
  p.body.addEventListener('click', async (e) => {
    if (e.target.closest('[data-back]')) { openId = null; draw(); return; }
    const row = e.target.closest('[data-msg]'); if (!row) return;
    openId = row.dataset.msg; draw();
    const m = store.get().messages.find((x) => x.id === openId);
    if (m && !m.read) { store.set((s) => ({ messages: s.messages.map((x) => (x.id === openId ? { ...x, read: true } : x)) })); try { await readMessage(openId); } catch { /* retried next poll */ } }
  });
  refreshMessages().then(() => { if (!openId) draw(); });
}

// ---- Sovereign Registry --------------------------------------------------------
export function openRegistry() {
  const p = openPanel({ title: 'The Sovereign Registry', cls: 'registry' });
  const draw = () => {
    const { stats, team } = store.get();
    if (!stats) { p.body.innerHTML = '<p class="dim">Doom is counting&hellip;</p>'; return; }
    const rows = stats.top10.map((t, i) => `<tr class="${team && t.name === team.name ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(t.name)}</td><td class="n">${t.score}</td></tr>`).join('');
    const mine = team && !stats.top10.some((t) => t.name === team.name) ? `<tr class="me"><td class="n">${team.place ?? '-'}</td><td>${esc(team.name)} (you)</td><td class="n">${team.score ?? 0}</td></tr>` : '';
    const fb = Object.entries(stats.first_blood ?? {}).slice(-8).reverse();
    p.body.innerHTML = `<p class="dim" style="margin-top:0">${stats.teams} teams &middot; ${stats.total_solves} tasks fallen</p>
      <table class="reg"><thead><tr><th class="n">#</th><th>Team</th><th class="n">Score</th></tr></thead><tbody>${rows}${mine}</tbody></table>
      ${fb.length ? `<h3 class="dim" style="font-size:.78em;letter-spacing:.14em;text-transform:uppercase;margin:18px 0 6px">First blood</h3><ul style="margin:0;padding-left:18px">${fb.map(([k, team]) => `<li>${esc(k.replace(/^[a-z]+-/, '').replace(/-/g, ' '))} &mdash; <b style="color:var(--amber)">${esc(team)}</b></li>`).join('')}</ul>` : ''}`;
  };
  draw(); refreshStats().then(draw);
}

// ---- Settings ------------------------------------------------------------------
export function openSettings({ onMode, replayOpening }) {
  const p = openPanel({ title: 'Settings', cls: 'settings' });
  const pr = prefs();
  const slider = (id, label, v) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="range" min="0" max="1" step="0.05" value="${v}"></div>`;
  p.body.innerHTML = `
    <div class="field"><label for="s-mode">Display mode</label><select id="s-mode" data-autofocus>
      <option value="auto" ${pr.mode === 'auto' ? 'selected' : ''}>Auto (recommended)</option><option value="full" ${pr.mode === 'full' ? 'selected' : ''}>Full: light 3D map</option>
      <option value="flat" ${pr.mode === 'flat' ? 'selected' : ''}>Flat: 2D map</option><option value="lite" ${pr.mode === 'lite' ? 'selected' : ''}>Lite: text only, fastest</option></select></div>
    ${slider('s-master', 'Master volume', pr.master)}${slider('s-music', 'Music and ambience', pr.music)}${slider('s-sfx', 'Effects', pr.sfx)}
    <div class="field"><label for="s-mute">Mute everything</label><input id="s-mute" type="checkbox" ${pr.muted ? 'checked' : ''}></div>
    <div class="field"><label for="s-motion">Reduce motion</label><input id="s-motion" type="checkbox" ${prefersReducedMotion() ? 'checked' : ''}></div>
    <div class="field"><label for="s-big">Larger text</label><input id="s-big" type="checkbox" ${pr.bigText ? 'checked' : ''}></div>
    <div class="row" style="cursor:default"><span class="grow dim">Settings are saved in this browser only.</span><button class="btn small" id="s-replay">Replay opening</button> <a class="btn small" href="/themes/doomsday/static/prepare.html">Prepare device</a></div>`;
  const root = document.documentElement;
  p.body.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id === 's-master') setPref('master', +e.target.value); if (id === 's-music') setPref('music', +e.target.value); if (id === 's-sfx') setPref('sfx', +e.target.value);
    audio.applyVolumes();
  });
  p.body.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 's-mute') { setPref('muted', e.target.checked); audio.applyVolumes(); }
    if (id === 's-motion') { setPref('reducedMotion', e.target.checked); root.dataset.reduced = e.target.checked ? '1' : '0'; }
    if (id === 's-big') { setPref('bigText', e.target.checked); root.dataset.bigtext = e.target.checked ? '1' : '0'; }
    if (id === 's-mode') { setPref('mode', e.target.value); p.close(); onMode(e.target.value); }
  });
  p.body.querySelector('#s-replay').addEventListener('click', () => { p.close(); replayOpening(); });
}
