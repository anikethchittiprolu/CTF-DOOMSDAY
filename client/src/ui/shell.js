import { store, incursionLeftNow, pollNow, accountKey } from '../data.js';
import { formatLeft } from '../lib/clock.js';
import { esc } from '../lib/text.js';
import { regionById, N } from '../lib/dialogue.js';
import { net } from '../net.js';
import { on } from '../lib/bus.js';

export function buildShell(root) {
  root.innerHTML = `
    <header id="hud">
      <div class="left">
        <span class="brand">Doomsday</span>
        <button class="btn small" id="btn-back" hidden>&larr; Map</button>
        <span class="where" id="where"></span>
      </div>
      <div class="clock" id="clock" role="timer" aria-label="Incursion clock">
        <div class="t" id="clock-t">--:--:--</div>
        <div class="l" id="clock-l">Incursion clock</div>
      </div>
      <div class="right">
        <div class="teamcard" id="teamcard"></div>
        <button class="btn small hud-btn" id="btn-map" title="Map (M)">Map<kbd>M</kbd></button>
        <button class="btn small hud-btn" id="btn-codex" title="Codex (C)">Codex<kbd>C</kbd><span class="dot" id="dot-codex"></span></button>
        <button class="btn small hud-btn" id="btn-comms" title="Comms (T)">Comms<kbd>T</kbd><span class="dot" id="dot-comms"></span></button>
        <button class="btn small hud-btn" id="btn-registry" title="Sovereign Registry (R)">Registry<kbd>R</kbd></button>
        <button class="btn small hud-btn" id="btn-settings" title="Settings (S)">Settings<kbd>S</kbd></button>
      </div>
    </header>
    <main id="stage" tabindex="-1"></main>
    <aside id="dialogue" aria-live="polite"><div class="face" id="dlg-face"></div><div><div class="who" id="dlg-who"></div><div class="say" id="dlg-say"></div></div></aside>
    <div id="toasts" aria-live="polite"></div>
    <div id="offline" role="status" hidden><span id="offline-msg"></span><button class="btn small" id="offline-retry">Retry now</button><button class="btn small" id="offline-lite" hidden>Switch to Lite mode</button></div>
    <div id="layer"></div>`;
  return {
    stage: root.querySelector('#stage'), layer: root.querySelector('#layer'), toasts: root.querySelector('#toasts'),
    $: (s) => root.querySelector(s),
  };
}

export function bindHud(ui, { onBack }) {
  const clock = ui.$('#clock'), ct = ui.$('#clock-t'), cl = ui.$('#clock-l');
  const tick = () => {
    const s = store.get().state;
    if (!s?.configured) { ct.textContent = '--:--:--'; return; }
    const left = incursionLeftNow();
    ct.textContent = formatLeft(left);
    clock.classList.toggle('last-hour', left <= 1 && s.act !== 'END');
    cl.textContent = s.act === 'END' ? 'The trial is over' : s.paused ? 'Clock paused' : `Act ${s.act} · Round ${s.phase}/${s.rounds_total}`;
  };
  tick(); setInterval(tick, 1000);
  const render = (st) => {
    const t = st.team;
    ui.$('#teamcard').innerHTML = t ? `<b>${esc(t.name)}</b><br>${t.score ?? 0} pts &middot; rank ${t.place ?? '-'}` : '';
    const unreadMsg = st.messages.filter((m) => !m.read).length;
    const dm = ui.$('#dot-comms'); dm.textContent = unreadMsg || '';
    const unseen = st.broadcasts.filter((b) => !seenBroadcast(b.key)).length;
    const dc = ui.$('#dot-codex'); dc.textContent = unseen ? '!' : '';
  };
  store.subscribe(render); render(store.get());
  ui.$('#btn-back').addEventListener('click', onBack);
  on('net', ({ online }) => setOffline(ui, !online));
  ui.$('#offline-retry').addEventListener('click', () => pollNow());
  return {
    setWhere(text, canGoBack) { ui.$('#where').textContent = text; ui.$('#btn-back').hidden = !canGoBack; },
  };
}

let failureCount = 0;
function setOffline(ui, off) {
  const el = ui.$('#offline');
  failureCount = off ? failureCount + 1 : 0;
  el.hidden = !off;
  ui.$('#offline-msg').textContent = 'Connection lost. Your progress is safe on the server. The game will keep retrying.';
  ui.$('#offline-lite').hidden = failureCount < 3;
}

// Broadcast "seen" bookkeeping lives in prefs, keyed by team (harmless convenience only).
import { prefs, setPref } from '../lib/prefs.js';
export const seenBroadcast = (key) => (prefs().seenBoot?.[accountKey()]?.broadcasts ?? []).includes(key);
export function markBroadcastSeen(key) {
  const all = { ...(prefs().seenBoot ?? {}) }, mine = { ...(all[accountKey()] ?? {}) };
  mine.broadcasts = [...new Set([...(mine.broadcasts ?? []), key])]; all[accountKey()] = mine; setPref('seenBoot', all);
}
export const bootSeen = () => !!prefs().seenBoot?.[accountKey()]?.boot;
export function markBootSeen() {
  const all = { ...(prefs().seenBoot ?? {}) }, mine = { ...(all[accountKey()] ?? {}) }; mine.boot = true; all[accountKey()] = mine; setPref('seenBoot', all);
}
