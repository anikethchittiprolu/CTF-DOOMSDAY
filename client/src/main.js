import './style.css';
import { config } from './config.js';
import { prefs, prefersReducedMotion, setPref } from './lib/prefs.js';
import { on } from './lib/bus.js';
import { store, load, pollNow, accountKey } from './data.js';
import { buildShell, bindHud, seenBroadcast, bootSeen, markBootSeen } from './ui/shell.js';
import { initToasts, toast } from './ui/toast.js';
import { initPanels, panelOpen } from './ui/panel.js';
import { initDialogue, speak } from './ui/dialogue.js';
import { createStage, resolveMode } from './ui/stage.js';
import { openChallenge } from './ui/card.js';
import { openCodex, openComms, openRegistry, openSettings } from './ui/overlays.js';
import { playBroadcast } from './ui/broadcast.js';
import { runBoot } from './ui/boot.js';
import { audio } from './audio/audio.js';
import { pick, speakerName } from './lib/dialogue.js';
import { esc } from './lib/text.js';

const t0 = performance.now(); // ms since navigation start: used for the 15 s Lite rule

async function main() {
  const root = document.getElementById('app');
  const html = document.documentElement;
  html.dataset.reduced = prefersReducedMotion() ? '1' : '0';
  html.dataset.bigtext = prefs().bigText ? '1' : '0';

  if (config.mock) {
    if (import.meta.env.VITE_MOCK === '1') await import('./api/mock.js');
    else { root.textContent = 'This build needs to run inside CTFd.'; return; }
  }

  // Browsers only allow sound after a gesture, so audio starts on the first click or key.
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { once: true, capture: true });
  const ui = buildShell(root);
  initToasts(ui.toasts); initPanels(ui.layer); initDialogue(root);

  // Connect first, with a visible retry, because the network at the venue may be poor.
  const status = (html2) => { ui.stage.innerHTML = `<div style="display:grid;place-items:center;height:100%;text-align:center;padding:24px">${html2}</div>`; };
  for (let attempt = 1; ; attempt++) {
    status(`<div><div class="brand" style="font-size:1.1em">Connecting to Latveria</div><p class="dim">${attempt > 1 ? `Attempt ${attempt}. ` : ''}The game only exchanges small messages. Hold on.</p></div>`);
    try { await load(); break; } catch {
      status(`<div><div class="brand">The server is out of reach</div><p class="dim">Your progress is safe. Check your Wi-Fi, or switch to a phone hotspot.</p><button class="btn primary" id="retry">Try again</button> <a class="btn" href="/themes/doomsday/static/prepare.html">Prepare device</a></div>`);
      await new Promise((r) => { const to = setTimeout(r, Math.min(20000, 3000 * attempt)); ui.stage.querySelector('#retry').addEventListener('click', () => { clearTimeout(to); r(); }); });
    }
  }

  const { mode, why } = resolveMode(config.params, t0);
  let stage;
  const playById = async (key) => { const b = store.get().broadcasts.find((x) => x.key === key); if (b) await playBroadcast(ui.layer, b); };
  const hud = bindHud(ui, { onBack: () => stage.showMap() });
  stage = createStage(ui, hud, { mode, openChallenge });
  window.__game = { stage, store, mode, why };

  // Start screen: boot, then the opening broadcast the first time only.
  if (!config.params.has('noboot')) {
    const team = store.get().team;
    await runBoot(ui.layer, { teamName: team?.name ?? config.userName, teamId: team?.id ?? config.init?.teamId ?? 0, full: !bootSeen() });
  }
  const first = store.get().broadcasts.find((b) => b.key === 'h0');
  if (first && !seenBroadcast('h0') && !config.params.has('nobroadcast')) await playBroadcast(ui.layer, first);
  markBootSeen();
  await stage.showMap();
  document.body.dataset.ready = '1';

  // ---- events ---------------------------------------------------------------
  on('release', ({ phase }) => toast(`<b>Round ${phase} is open.</b> New tasks have been released.`, { sound: 'alert', kind: 'warn' }));
  on('act', ({ act }) => { const l = pick('act_change', { act }); if (l) speak(l, 8000); });
  on('solved', () => stage.refresh());
  on('new-messages', (ms) => ms.forEach((m) => toast(`<b>${esc(speakerName(m.from))}</b>: ${esc(m.subject)}`, { sound: 'alert', action: { label: 'Open comms', run: openComms } })));
  on('new-broadcasts', (bs) => bs.forEach((b) => toast(`<b>Doom addresses the applicants.</b> ${esc(b.title)}`, { kind: 'warn', ms: 15000, sound: 'alert', action: { label: 'Watch', run: () => playById(b.key) } })));
  ui.$('#offline-lite').addEventListener('click', () => { setPref('mode', 'lite'); stage.setMode('lite'); });

  const openers = {
    codex: () => openCodex('entries', { playBroadcast: playById }), comms: openComms, registry: openRegistry,
    settings: () => openSettings({ onMode: (m) => { if (m === 'auto') setPref('autoFlat', false); stage.setMode(m === 'auto' ? resolveMode(new URLSearchParams(), 0).mode : m); }, replayOpening: replay }),
  };
  async function replay() { await runBoot(ui.layer, { teamName: store.get().team?.name, teamId: store.get().team?.id, full: true }); const b = store.get().broadcasts.find((x) => x.key === 'h0'); if (b) await playBroadcast(ui.layer, b); }
  ui.$('#btn-map').addEventListener('click', () => stage.showMap());
  ui.$('#btn-codex').addEventListener('click', openers.codex);
  ui.$('#btn-comms').addEventListener('click', openers.comms);
  ui.$('#btn-registry').addEventListener('click', openers.registry);
  ui.$('#btn-settings').addEventListener('click', openers.settings);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (panelOpen() || document.getElementById('broadcast') || document.getElementById('boot')) return;
    const k = e.key.toLowerCase();
    if (k === 'm') stage.showMap();
    else if (k === 'c') openers.codex();
    else if (k === 't') openers.comms();
    else if (k === 'r') openers.registry();
    else if (k === 's') openers.settings();
    else if (k === 'b') openCodex('broadcasts', { playBroadcast: playById });
    else if (k === 'e') { const a = document.activeElement; if (a?.matches?.('.hot, .map-label')) a.click(); }
    else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w'].includes(k)) { if (spatial(k)) e.preventDefault(); }
  });
}

/** Move focus to the nearest hotspot or map label in a direction. */
function spatial(key) {
  const dir = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1] }[key];
  if (!dir) return false;
  const els = [...document.querySelectorAll('.hot, .map-label')].filter((n) => n.offsetParent !== null);
  if (!els.length) return false;
  const cur = els.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { els[0].focus(); return true; }
  const c = cur.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  let best = null, bs = Infinity;
  for (const n of els) {
    if (n === cur) continue;
    const r = n.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    const along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1] - dy * dir[0]);
    if (along <= 4) continue;
    const score = along + across * 1.6;
    if (score < bs) { bs = score; best = n; }
  }
  if (best) best.focus();
  return true;
}

main().catch((e) => { console.error(e); const r = document.getElementById('app'); if (r) r.insertAdjacentHTML('beforeend', '<pre style="color:#ff6b6b;padding:16px;position:relative;z-index:200">The game hit an error. Reload the page, or open it with ?mode=lite.</pre>'); });
