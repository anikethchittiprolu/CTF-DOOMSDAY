import { store, regionStatus, challengesIn, markRegionSeen, tierOf, incursionLeftNow } from '../data.js';
import { regions, regionById, pick } from '../lib/dialogue.js';
import { loadScene } from '../scenes/index.js';
import { tierBadge } from '../lib/tiers.js';
import { esc } from '../lib/text.js';
import { speak, hideSpeech } from './dialogue.js';
import { audio } from '../audio/audio.js';
import { prefersReducedMotion, prefs, setPref } from '../lib/prefs.js';
import { renderLite } from './lite.js';
import { formatLeft } from '../lib/clock.js';
import { toast } from './toast.js';

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export function resolveMode(params, loadMs) {
  const q = params.get('mode');
  if (['full', 'flat', 'lite'].includes(q)) return { mode: q, why: 'url' };
  const p = prefs().mode;
  if (['full', 'flat', 'lite'].includes(p)) return { mode: p, why: 'pref' };
  const c = navigator.connection;
  if (c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType))) return { mode: 'lite', why: 'slow-connection' };
  if (loadMs > 15000) return { mode: 'lite', why: 'slow-first-load' };
  if (!webglOk()) return { mode: 'flat', why: 'no-webgl' };
  if (prefs().autoFlat) return { mode: 'flat', why: 'earlier-benchmark' };
  return { mode: 'full', why: 'default' };
}

export function createStage(ui, hud, { mode, openChallenge }) {
  let screen = null, map = null, lite = null, region = null, unsub = null, tickTimer = null, current = { mode };
  const stage = ui.stage;
  const reduced = () => prefersReducedMotion();

  function teardown() {
    map?.dispose(); map = null; lite?.dispose(); lite = null; unsub?.(); unsub = null; clearInterval(tickTimer); region = null;
    stage.replaceChildren();
  }

  async function showMap({ announce = true } = {}) {
    teardown(); screen = 'map'; hideSpeech();
    hud.setWhere('Latveria', false); audio.setRegion(null);
    document.getElementById('app').dataset.screen = 'map';
    if (current.mode === 'lite') { lite = renderLite(stage, { openChallenge }); hud.setWhere('Latveria · Lite mode', false); return; }
    const host = document.createElement('div'); host.className = 'map-host'; host.style.position = 'absolute'; host.style.inset = '0'; stage.appendChild(host);
    const opts = { regions, getStatus: regionStatus, onSelect: (id) => showRegion(id), onHover: () => {}, reduced: reduced() };
    if (current.mode === 'full') {
      try {
        const { createMap3d } = await import('../map/map3d.js');
        if (screen !== 'map') return;
        map = await createMap3d(host, opts);
        map.onLost(() => fallback('context-lost'));
        map.start();
        map.benchmark().then((r) => {
          window.__bench = r;
          if (!r.ok && current.mode === 'full' && screen === 'map' && !config_forceFull()) { setPref('autoFlat', true); fallback('slow'); }
        });
      } catch { return fallback('webgl-error'); }
    } else {
      const { createMapFlat } = await import('../map/mapflat.js');
      map = createMapFlat(host, opts); map.start();
    }
    syncMap();
    unsub = store.subscribe(syncMap);
    const hint = document.createElement('div'); hint.className = 'map-hint'; hint.innerHTML = 'Choose a region &middot; <b>Arrow keys</b> move, <b>Enter</b> travels';
    host.appendChild(hint);
    host.querySelector('.map-label')?.focus({ preventScroll: true });
  }
  const config_forceFull = () => new URLSearchParams(location.search).get('mode') === 'full' || prefs().mode === 'full';
  function syncMap() {
    const s = store.get().state;
    map?.refresh(); map?.setIncursion(s?.incursion ?? 0); audio.setIncursion(s?.incursion ?? 0);
  }
  async function fallback(why) {
    if (current.mode !== 'full') return;
    current = { mode: 'flat', why }; toast('Switched to the flat map so the game runs smoothly on this device.', { kind: 'warn' });
    if (screen === 'map') showMap();
  }

  async function showRegion(id) {
    teardown(); screen = 'region'; region = id;
    const reg = regionById[id]; const st = regionStatus(id);
    document.getElementById('app').dataset.screen = 'region';
    hud.setWhere(reg.name, true); audio.sfx('whoosh'); audio.setRegion(id); markRegionSeen(id);
    if (current.mode === 'lite') { lite = renderLite(stage, { openChallenge }); hud.setWhere('Latveria · Lite mode', false); return; }
    let scene;
    try { scene = await loadScene(id); } catch { toast('Could not load that region. Check your connection.', { kind: 'bad' }); return showMap(); }
    if (screen !== 'region' || region !== id) return;
    const wrap = document.createElement('div'); wrap.className = 'scene'; wrap.dataset.region = id;
    wrap.innerHTML = `<div class="scene-frame"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(reg.name)}: ${esc(reg.tagline)}">${scene.svg()}</svg><div class="hots"></div>
      <div class="scene-info"><h2>${esc(reg.name)}</h2><div class="dim" id="si-sub"></div><div class="dim" id="si-next"></div></div></div>`;
    stage.appendChild(wrap);
    const draw = () => {
      const list = challengesIn(id), s = regionStatus(id);
      const hots = wrap.querySelector('.hots');
      const focusId = document.activeElement?.dataset?.id;
      hots.innerHTML = list.slice(0, scene.slots.length).map((c, i) => {
        const [x, y] = scene.slots[i], t = tierOf(c);
        return `<button class="hot ${c.solved_by_me ? 'solved' : ''}" data-id="${c.id}" style="left:${(x / 16).toFixed(2)}%;top:${(y / 9).toFixed(2)}%;--tc:${t.colour}" aria-label="${esc(c.name)}. ${esc(t.label)}, ${c.value} points${c.solved_by_me ? ', solved' : ''}">${tierBadge(t, 22)}<span class="tip">${esc(c.name)} &middot; ${c.value}</span></button>`;
      }).join('') + Array.from({ length: Math.max(0, Math.min(scene.slots.length, s.total) - list.length) }, (_, k) => {
        const [x, y] = scene.slots[list.length + k];
        return `<div class="sealed" aria-hidden="true" style="left:${(x / 16).toFixed(2)}%;top:${(y / 9).toFixed(2)}%">?</div>`;
      }).join('');
      if (focusId) hots.querySelector(`[data-id="${focusId}"]`)?.focus();
      wrap.querySelector('#si-sub').textContent = `${s.released} open · ${s.solved} solved · ${Math.max(0, s.total - s.released)} sealed`;
    };
    const next = () => {
      const s = store.get().state; const el = wrap.querySelector('#si-next'); if (!el) return;
      if (!s?.next_phase_at || s.paused) { el.textContent = ''; return; }
      const warp = new URLSearchParams(location.search).get('warp') ?? 1;
      const ms = (Date.parse(s.next_phase_at) - Date.parse(s.now) - (performance.now() - store.get().stateAt) * Number(warp)) / Number(warp);
      el.textContent = ms > 0 ? `Next release in ${formatLeft(ms / 3600000)}` : 'New tasks arriving…';
    };
    draw(); next(); unsub = store.subscribe(() => { draw(); next(); }); tickTimer = setInterval(next, 1000);
    speak(pick('region_enter', { region: id }) ?? null, 7000);
    wrap.querySelector('.hot')?.focus({ preventScroll: true });
  }
  wireClicks();
  function wireClicks() {
    stage.addEventListener('click', (e) => { const h = e.target.closest('.hot'); if (h) openChallenge(Number(h.dataset.id)); });
  }
  return {
    showMap, showRegion, get screen() { return screen; }, get region() { return region; }, get mode() { return current.mode; },
    setMode(m) { current = { mode: m }; return screen === 'region' ? showMap() : showMap(); },
    refresh() { if (screen === 'map') syncMap(); },
    destroy: teardown,
  };
}
