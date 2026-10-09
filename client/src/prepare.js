import './style.css';

const BASE = location.pathname.replace(/[^/]*$/, '');
const el = document.getElementById('prepare');
const rows = {};
const KEY = 'doom.prefs.v1';
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const patchPrefs = (patch) => { try { const p = JSON.parse(localStorage.getItem(KEY) || '{}'); localStorage.setItem(KEY, JSON.stringify({ ...p, ...patch })); } catch { /* private window */ } };

el.innerHTML = `
  <div class="brand" style="font-size:1.1em">Doomsday &middot; Prepare your device</div>
  <p class="dim">Do this once, a few days before the event, on every device you will use. It downloads the game so that on the day it only sends tiny messages, which matters on college Wi-Fi.</p>
  <div class="panel" style="margin:16px 0"><div class="panel-body">
    <div id="progress" style="margin-bottom:12px"><div style="height:8px;background:var(--line)"><i id="bar" style="display:block;height:100%;width:0;background:var(--em)"></i></div><div id="ptext" class="dim" style="margin-top:6px;font-size:.85em">Starting&hellip;</div></div>
    <ul id="checks" style="list-style:none;margin:0;padding:0;display:grid;gap:8px"></ul>
  </div></div>
  <div id="verdict" class="panel" style="margin-bottom:16px" hidden><div class="panel-body"></div></div>
  <p><button class="btn primary" id="run">Run the check again</button> <a class="btn" id="go" href="/challenges">Open the game</a></p>`;

function check(id, label) {
  const li = document.createElement('li'); li.id = 'chk-' + id; li.style.cssText = 'display:flex;gap:10px;align-items:baseline';
  li.innerHTML = `<span data-s style="width:5.5em;font-size:.8em;letter-spacing:.1em">...</span><span><b>${label}</b> <span class="dim" data-d></span></span>`;
  el.querySelector('#checks').appendChild(li); rows[id] = li; return li;
}
function setCheck(id, state, detail) {
  const s = rows[id].querySelector('[data-s]'); s.textContent = { ok: 'READY', warn: 'WARNING', bad: 'PROBLEM', run: 'CHECKING' }[state];
  s.style.color = { ok: 'var(--em)', warn: 'var(--amber)', bad: 'var(--red)', run: 'var(--dim)' }[state];
  rows[id].querySelector('[data-d]').textContent = detail || '';
}

async function loadManifest() {
  const r = await fetch(BASE + 'asset-manifest.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('manifest ' + r.status);
  return r.json();
}

function swMessage(sw, msg, onMsg) {
  return new Promise((resolve) => {
    const handler = (e) => { onMsg(e.data); if (e.data.type === 'done' || e.data.type === 'status') { navigator.serviceWorker.removeEventListener('message', handler); resolve(e.data); } };
    navigator.serviceWorker.addEventListener('message', handler); sw.postMessage(msg);
  });
}

async function cacheAssets(manifest) {
  const urls = manifest.files.map((f) => BASE + f.path);
  const bar = el.querySelector('#bar'), txt = el.querySelector('#ptext');
  const progress = (done, total, failed = 0) => { bar.style.width = (done / total * 100) + '%'; txt.textContent = `${done} of ${total} files${failed ? `, ${failed} failed` : ''} (${mb(manifest.totalBytes)} total)`; };
  if ('serviceWorker' in navigator && window.isSecureContext) {
    try {
      await navigator.serviceWorker.register('/doom-sw.js', { scope: '/' });
      const reg = await navigator.serviceWorker.ready;
      const sw = reg.active;
      const r = await swMessage(sw, { type: 'precache', urls }, (m) => { if (m.type === 'progress') progress(m.done, m.total, m.failed); });
      progress(r.total, r.total, r.failed);
      return { ok: r.failed === 0, mode: 'service worker', failed: r.failed };
    } catch (e) { /* fall through to the HTTP cache */ }
  }
  let done = 0, failed = 0;
  for (const u of urls) { try { const res = await fetch(u, { cache: 'force-cache' }); if (!res.ok) throw 0; await res.arrayBuffer(); } catch { failed++; } progress(++done, urls.length, failed); }
  return { ok: failed === 0, mode: window.isSecureContext ? 'browser cache' : 'browser cache (the site is not HTTPS, so offline caching is limited)', failed };
}

function benchmark() {
  return new Promise((resolve) => {
    let gl; const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    try { gl = c.getContext('webgl2') || c.getContext('webgl'); } catch { /* none */ }
    if (!gl) return resolve({ webgl: false });
    document.body.appendChild(c); c.style.cssText = 'position:fixed;left:-9999px';
    const t = [];
    let last = performance.now(), n = 0;
    const step = (now) => { gl.clearColor(Math.random() * 0.1, 0.1, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.finish(); t.push(now - last); last = now; if (++n < 45) requestAnimationFrame(step); else { c.remove(); const s = t.slice(8); const avg = s.reduce((a, b) => a + b, 0) / s.length; resolve({ webgl: true, ms: avg, fps: 1000 / avg }); } };
    requestAnimationFrame(step); setTimeout(() => { if (n < 45) { c.remove(); resolve({ webgl: true, ms: 999, fps: 0 }); } }, 6000);
  });
}

async function run() {
  el.querySelector('#checks').innerHTML = ''; el.querySelector('#verdict').hidden = true;
  check('assets', 'Game files'); check('net', 'Connection to the server'); check('gpu', 'Graphics'); check('audio', 'Sound'); check('store', 'Saved settings');
  let manifest = null, cached = null;
  setCheck('assets', 'run', 'downloading');
  try { manifest = await loadManifest(); cached = await cacheAssets(manifest); setCheck('assets', cached.ok ? 'ok' : 'bad', cached.ok ? `${manifest.files.length} files saved on this device via ${cached.mode}` : `${cached.failed} files failed. Run the check again on a better connection.`); } catch (e) { setCheck('assets', 'bad', 'could not download. Are you online?'); }

  setCheck('net', 'run');
  const t = performance.now();
  try { const r = await fetch(BASE + 'asset-manifest.json', { cache: 'no-store' }); await r.arrayBuffer(); const ms = Math.round(performance.now() - t); setCheck('net', ms < 1500 ? 'ok' : 'warn', `${ms} ms for a small request${ms >= 1500 ? '. Slow: expect Lite mode, or use a phone hotspot.' : ''}`); } catch { setCheck('net', 'bad', 'the server did not answer'); }
  const conn = navigator.connection;

  setCheck('gpu', 'run', 'testing for a moment');
  const g = await benchmark();
  let rec = 'full';
  if (!g.webgl) { rec = 'flat'; setCheck('gpu', 'warn', 'WebGL is not available. The flat 2D map will be used.'); }
  else if (g.fps < 28) { rec = 'flat'; setCheck('gpu', 'warn', `${Math.round(g.fps)} fps in the test. The flat 2D map will be used so the game stays smooth.`); }
  else setCheck('gpu', 'ok', `${Math.round(g.fps)} fps. The light 3D map will run.`);
  if (conn && (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType))) rec = 'lite';

  const AC = window.AudioContext || window.webkitAudioContext;
  setCheck('audio', AC ? 'ok' : 'warn', AC ? 'available. Sound starts after your first click.' : 'not available. The game is fully playable with subtitles.');
  try { localStorage.setItem('doom.test', '1'); localStorage.removeItem('doom.test'); setCheck('store', 'ok', 'this browser keeps your settings'); } catch { setCheck('store', 'warn', 'private window. Settings will not be remembered.'); }

  const allOk = manifest && cached && cached.ok;
  if (g.webgl === false || g.fps < 28) patchPrefs({ autoFlat: true });
  patchPrefs({ prepared: { at: Date.now(), ok: !!allOk, recommended: rec } });
  const v = el.querySelector('#verdict'); v.hidden = false;
  v.querySelector('.panel-body').innerHTML = allOk
    ? `<b style="color:var(--em)">THIS DEVICE IS READY.</b><br>Recommended mode: <b>${rec === 'full' ? 'Full (light 3D map)' : rec === 'flat' ? 'Flat (2D map)' : 'Lite (text only)'}</b>. The game will pick it for you. Do this on each of your devices.`
    : `<b style="color:var(--amber)">NOT READY YET.</b><br>Run the check again on a better connection. If it keeps failing, the game still works in Lite mode: add <code>?mode=lite</code> to the address.`;
}
el.querySelector('#run').addEventListener('click', run);
run();
