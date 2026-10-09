// Light 3D world map: dark fog, silhouettes of the ten regions, one drifting camera.
// Budget: well under 20k triangles, one directional light, no shadows, no post-processing.
import {
  WebGLRenderer, Scene, PerspectiveCamera, FogExp2, Color, PlaneGeometry, MeshLambertMaterial, MeshBasicMaterial, Mesh, Group,
  BoxGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, RingGeometry, SphereGeometry, IcosahedronGeometry, BufferGeometry, Float32BufferAttribute,
  Points, PointsMaterial, ShaderMaterial, BackSide, AdditiveBlending, DirectionalLight, AmbientLight, Raycaster, Vector2, Vector3, MathUtils,
} from 'three';

const WORLD_W = 34, WORLD_D = 20;
const rngSeed = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

export const heightAt = (x, z) => {
  const edge = Math.max(0, 1 - Math.pow(Math.min(1, Math.hypot(x / (WORLD_W * 0.62), z / (WORLD_D * 0.7))), 3));
  return (Math.sin(x * 0.45) * Math.cos(z * 0.5) * 0.55 + Math.sin(x * 0.17 + z * 0.23) * 0.9 + 0.4) * edge - (1 - edge) * 2.2;
};
export const toWorld = (mx, my) => ({ x: (mx - 0.5) * WORLD_W, z: (my - 0.5) * WORLD_D });

const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
// NaN-safe: no pow() on negatives, smoothstep edges ordered, everything clamped.
const SKY_FRAG = `
varying vec3 vDir; uniform float uInc; uniform float uTime;
void main(){
  vec3 d = normalize(vDir);
  float y = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(vec3(0.03, 0.05, 0.045), vec3(0.008, 0.016, 0.034), y);
  vec2 p = d.xz / (abs(d.y) + 0.35) * 3.0;
  float n = sin(p.x * 3.1 + sin(p.y * 2.3)) * sin(p.y * 2.7 + sin(p.x * 1.9));
  float line = 1.0 - smoothstep(0.0, 0.07, abs(n));
  float vis = clamp(uInc * 1.5 - 0.2, 0.0, 1.0) * smoothstep(0.12, 0.5, y);
  col += vec3(1.0, 0.16, 0.1) * line * vis * (0.65 + 0.35 * sin(uTime * 1.6 + p.x));
  col = mix(col, vec3(0.30, 0.025, 0.035), clamp(uInc, 0.0, 1.0) * 0.55 * y);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const COLOUR = { locked: 0x4a5a66, open: 0x3ddc84, cleared: 0xe0a63a, fresh: 0x9bffc8 };

export async function createMap3d(host, { regions, getStatus, onSelect, onHover, reduced = false }) {
  const canvasHost = document.createElement('div');
  canvasHost.className = 'map3d-canvas';
  host.prepend(canvasHost);
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
  canvasHost.appendChild(renderer.domElement);
  const dead = { lost: false };
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead.lost = true; onLost?.(); });
  let onLost = null;

  const scene = new Scene();
  scene.background = new Color(0x050908);
  scene.fog = new FogExp2(0x050908, 0.016);
  const camera = new PerspectiveCamera(44, 1, 0.5, 140);
  scene.add(new AmbientLight(0x6a8a7a, 0.7));
  const sun = new DirectionalLight(0xbfe8d4, 0.9); sun.position.set(-8, 14, 6); scene.add(sun);

  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };

  // sky
  const skyMat = keep(new ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: BackSide, depthWrite: false, fog: false, uniforms: { uInc: { value: 0 }, uTime: { value: 0 } } }));
  const sky = new Mesh(keep(new SphereGeometry(70, 20, 12)), skyMat); scene.add(sky);
  const starPos = []; const sr = rngSeed(7);
  for (let i = 0; i < 260; i++) { const a = sr() * Math.PI * 2, b = Math.acos(0.15 + sr() * 0.85); starPos.push(Math.sin(b) * Math.cos(a) * 66, Math.cos(b) * 66, Math.sin(b) * Math.sin(a) * 66); }
  const starGeo = keep(new BufferGeometry()); starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
  scene.add(new Points(starGeo, keep(new PointsMaterial({ color: 0xcfe8dc, size: 0.35, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 }))));

  // second Earth
  const earthGeo = keep(new SphereGeometry(1, 16, 12));
  const ec = []; for (let i = 0; i < earthGeo.attributes.position.count; i++) { const y = earthGeo.attributes.position.getY(i); const band = Math.sin(y * 7 + i * 0.3) > 0.2; ec.push(band ? 0.2 : 0.1, band ? 0.5 : 0.3, band ? 0.3 : 0.6); }
  earthGeo.setAttribute('color', new Float32BufferAttribute(ec, 3));
  const earth = new Mesh(earthGeo, keep(new MeshBasicMaterial({ vertexColors: true, fog: false }))); earth.position.set(-22, 15, -34); earth.scale.setScalar(0.001); scene.add(earth);

  // terrain
  const tg = keep(new PlaneGeometry(WORLD_W * 1.7, WORLD_D * 2, 56, 36)); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, cols = [];
  for (let i = 0; i < tp.count; i++) {
    const h = heightAt(tp.getX(i), tp.getZ(i)); tp.setY(i, h);
    const t = MathUtils.clamp((h + 1) / 2.4, 0, 1);
    cols.push(0.05 + t * 0.07, 0.09 + t * 0.14, 0.08 + t * 0.1);
  }
  tg.setAttribute('color', new Float32BufferAttribute(cols, 3)); tg.computeVertexNormals();
  scene.add(new Mesh(tg, keep(new MeshLambertMaterial({ vertexColors: true, flatShading: true }))));

  // region silhouettes
  const iron = keep(new MeshLambertMaterial({ color: 0x1b2723, flatShading: true }));
  const ironLight = keep(new MeshLambertMaterial({ color: 0x2a3a34, flatShading: true }));
  const rock = keep(new MeshLambertMaterial({ color: 0x232c36, flatShading: true }));
  const emis = (c) => keep(new MeshBasicMaterial({ color: c, fog: true }));
  const add = (g, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new Mesh(keep(geo), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const BUILD = {
    doomstadt(g) { const r = rngSeed(3); for (let i = 0; i < 9; i++) add(g, new BoxGeometry(0.4, 1, 0.4), iron, (r() - 0.5) * 2.2, 0, (r() - 0.5) * 1.6, 1, 0.5 + r() * 1.5, 1).position.y = 0.4; add(g, new BoxGeometry(0.5, 2.2, 0.5), ironLight, 0, 1.1); add(g, new ConeGeometry(0.3, 0.6, 5), ironLight, 0, 2.5); add(g, new BoxGeometry(0.1, 0.1, 0.1), emis(0x3ddc84), 0, 1.7, 0.26); },
    embassy(g) { add(g, new BoxGeometry(0.9, 0.9, 0.7), iron, -0.5, 0.45); add(g, new BoxGeometry(0.9, 1.2, 0.7), ironLight, 0.5, 0.6); add(g, new BoxGeometry(1.7, 0.08, 0.05), emis(0xe0a63a), 0, 0.7, 0.37); },
    foundry(g) { add(g, new BoxGeometry(2.2, 0.8, 1.2), iron, 0, 0.4); add(g, new CylinderGeometry(0.15, 0.2, 1.6, 6), ironLight, -0.7, 1.2); add(g, new CylinderGeometry(0.15, 0.2, 1.3, 6), ironLight, 0.2, 1.05); add(g, new BoxGeometry(2.0, 0.08, 0.05), emis(0xff7a2f), 0, 0.5, 0.62); },
    archives(g) { add(g, new CylinderGeometry(0.35, 0.45, 2.2, 7), ironLight, 0, 1.1); add(g, new ConeGeometry(0.5, 0.9, 7), iron, 0, 2.6); for (const [x, z] of [[-0.9, 0.4], [0.9, 0.4], [-0.7, -0.6], [0.7, -0.6]]) { add(g, new CylinderGeometry(0.18, 0.22, 1.2, 6), iron, x, 0.6, z); add(g, new ConeGeometry(0.26, 0.5, 6), ironLight, x, 1.45, z); } },
    haasenstadt(g) { const r = rngSeed(5); for (let i = 0; i < 6; i++) add(g, new ConeGeometry(0.28, 0.55, 5), i % 2 ? iron : ironLight, (r() - 0.5) * 2, 0.27, (r() - 0.5) * 1.4); add(g, new SphereGeometry(0.1, 6, 4), emis(0xff9f43), 0.1, 0.12, 0.2); },
    monastery(g) { add(g, new ConeGeometry(1.1, 2.4, 6), rock, 0, 1.2); add(g, new ConeGeometry(0.4, 0.7, 6), emis(0xdfeaf5), 0, 2.15); add(g, new BoxGeometry(0.6, 0.4, 0.5), iron, 0, 1.55, 0.55); add(g, new BoxGeometry(0.1, 0.12, 0.05), emis(0xff7a2f), 0, 1.55, 0.82); },
    wundagore(g) { const r = rngSeed(9); for (let i = 0; i < 6; i++) { const m = add(g, new ConeGeometry(0.35 + r() * 0.3, 1.4 + r() * 1.8, 4), i % 2 ? rock : ironLight, (r() - 0.5) * 1.8, 0.9, (r() - 0.5) * 1.2); m.rotation.z = (r() - 0.5) * 0.5; m.rotation.x = (r() - 0.5) * 0.4; } },
    baxter(g) { const b = add(g, new BoxGeometry(1, 1, 1), ironLight, 0, 1.6); b.userData.spin = 0.4; add(g, new BoxGeometry(1.1, 0.06, 1.1), emis(0x4aa3ff), 0, 1.6).userData.spin = 0.4; },
    timeplatform(g) { const t = add(g, new TorusGeometry(1, 0.1, 6, 24), emis(0xf4d03f), 0, 1.7); t.rotation.x = 1.2; t.userData.spin = 0.25; add(g, new CylinderGeometry(0.5, 0.5, 0.12, 12), iron, 0, 0.4); },
    citadel(g) { add(g, new CylinderGeometry(0.22, 0.4, 2, 6), iron, 0, 1); add(g, new IcosahedronGeometry(0.9, 0), ironLight, 0, 2.5); const t = add(g, new TorusGeometry(1.2, 0.05, 5, 24), emis(0xff5d5d), 0, 0.15); t.rotation.x = Math.PI / 2; t.userData.spin = -0.3; },
  };

  const beamGeo = keep(new CylinderGeometry(0.015, 0.26, 3.2, 10, 1, true));
  const ringGeo = keep(new RingGeometry(1.15, 1.4, 28)); ringGeo.rotateX(-Math.PI / 2);
  const markers = {}, hits = [], spinners = [];
  const labelEls = {};
  const labelLayer = document.createElement('div'); labelLayer.className = 'map-labels'; host.appendChild(labelLayer);
  for (const r of regions) {
    const g = new Group(); const { x, z } = toWorld(r.map.x, r.map.y);
    g.position.set(x, Math.max(-0.1, heightAt(x, z)), z); g.scale.setScalar(1.15);
    BUILD[r.id]?.(g);
    g.traverse((o) => { if (o.userData.spin) spinners.push(o); });
    const bm = keep(new MeshBasicMaterial({ color: COLOUR.locked, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: 2 }));
    const beam = new Mesh(beamGeo, bm); beam.position.y = 2.9; g.add(beam);
    const ring = new Mesh(ringGeo, bm); ring.position.y = 0.06; g.add(ring);
    const hit = new Mesh(keep(new SphereGeometry(1.6, 6, 4)), keep(new MeshBasicMaterial({ visible: false }))); hit.position.y = 1; hit.userData.region = r.id; g.add(hit); hits.push(hit);
    scene.add(g); markers[r.id] = { g, bm, beam, base: g.scale.x };
    const el = document.createElement('button'); el.className = 'map-label'; el.type = 'button'; el.dataset.region = r.id;
    el.addEventListener('click', () => onSelect(r.id));
    el.addEventListener('focus', () => hover(r.id)); el.addEventListener('mouseenter', () => hover(r.id)); el.addEventListener('mouseleave', () => hover(null)); el.addEventListener('blur', () => hover(null));
    labelLayer.appendChild(el); labelEls[r.id] = el;
  }

  let hovered = null, focusId = null;
  const hover = (id) => { hovered = id; onHover?.(id); canvasHost.style.cursor = id ? 'pointer' : 'default'; };

  // interaction
  const ray = new Raycaster(), ptr = new Vector2(2, 2);
  let ptrDirty = false, lastPick = 0;
  const onMove = (e) => { const b = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ptrDirty = true; };
  const onClick = () => { if (hovered) onSelect(hovered); };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('click', onClick);

  const size = () => {
    const w = Math.max(320, host.clientWidth), h = Math.max(240, host.clientHeight);
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size); ro.observe(host); size();

  // loop: capped at 30 fps; paused when hidden
  let raf = 0, running = false, last = 0, acc = 0, t0 = performance.now();
  const frameTimes = [];
  let benchResolve = null, benchDone = false;
  const tmp = new Vector3(), look = new Vector3(0, 0, 1.2), lookGoal = new Vector3(0, 0, 1.2);
  let inc = 0;

  function refreshStatus() {
    for (const r of regions) {
      const s = getStatus(r.id); const m = markers[r.id];
      const key = s.cleared ? 'cleared' : s.fresh ? 'fresh' : s.released > 0 ? 'open' : 'locked';
      m.bm.color.setHex(COLOUR[key]); m.bm.opacity = s.released > 0 ? 0.34 : 0.16;
      const el = labelEls[r.id];
      el.innerHTML = `<span class="ml-name">${r.name}</span><span class="ml-meta">${s.released}/${s.total} open &middot; ${s.solved} solved</span>`;
      el.setAttribute('aria-label', `${r.name}. ${s.released} of ${s.total} challenges open, ${s.solved} solved. Press Enter to travel.`);
      el.dataset.state = key;
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || document.hidden || dead.lost) return;
    const dt = now - last; last = now;
    acc += dt;
    if (acc < 31) return; // ~30 fps cap
    const step = Math.min(acc, 100) / 1000; acc = 0;
    const t = (now - t0) / 1000;
    const c0 = performance.now();
    skyMat.uniforms.uTime.value = t; skyMat.uniforms.uInc.value = inc;
    const sc = MathUtils.clamp((inc - 0.4) / 0.35, 0, 1); earth.scale.setScalar(0.001 + sc * 4.2); earth.rotation.y = t * 0.05;
    const drift = reduced ? 0 : t * 0.045;
    const f = focusId ? markers[focusId].g.position : null;
    if (f) { lookGoal.set(f.x * 0.8, 0.8, f.z * 0.8); } else lookGoal.set(0, 0, 1.2);
    look.lerp(lookGoal, 1 - Math.exp(-step * 2.5));
    const goalX = (f ? f.x * 0.5 : 0) + Math.sin(drift) * 6, goalZ = (f ? f.z * 0.3 : 0) + 25 + Math.cos(drift * 0.8) * 1.5, goalY = 15.5 - (f ? 3 : 0) + Math.sin(drift * 1.3) * 0.6;
    camera.position.x += (goalX - camera.position.x) * (1 - Math.exp(-step * 1.4));
    camera.position.y += (goalY - camera.position.y) * (1 - Math.exp(-step * 1.4));
    camera.position.z += (goalZ - camera.position.z) * (1 - Math.exp(-step * 1.4));
    camera.lookAt(look);
    for (const s of spinners) s.rotation.y += (reduced ? 0 : s.userData.spin * step);
    for (const id in markers) {
      const m = markers[id]; const hot = id === hovered || id === focusId;
      m.g.scale.setScalar(m.base * (hot ? 1.12 : 1)); m.beam.scale.y = 1 + (reduced ? 0 : Math.sin(t * 2 + m.g.position.x) * 0.08);
    }
    if (ptrDirty && now - lastPick > 80) {
      ptrDirty = false; lastPick = now; ray.setFromCamera(ptr, camera);
      const h = ray.intersectObjects(hits, false)[0]; const id = h ? h.object.userData.region : null; if (id !== hovered) hover(id);
    }
    // labels
    const w = host.clientWidth, h = host.clientHeight;
    for (const id in markers) {
      tmp.copy(markers[id].g.position); tmp.y += 2.9; tmp.project(camera);
      const el = labelEls[id]; const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -100%)`;
      el.style.opacity = vis ? '' : '0';
      el.classList.toggle('hot', id === hovered || id === focusId);
    }
    renderer.render(scene, camera);
    if (!benchDone) {
      frameTimes.push({ cost: performance.now() - c0, at: now });
      if (frameTimes.length >= 50) finishBench();
    }
  }

  function finishBench() {
    benchDone = true;
    const f = frameTimes.slice(8); // skip warm-up and shader compile
    const span = f[f.length - 1].at - f[0].at;
    const interval = span / (f.length - 1);
    const cost = f.reduce((a, b) => a + b.cost, 0) / f.length;
    const res = { intervalMs: Math.round(interval), costMs: Math.round(cost * 10) / 10, fps: Math.round(1000 / interval), ok: interval <= 40 && cost <= 28 };
    benchResolve?.(res);
  }

  const api = {
    start() { if (running) return; running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); refreshStatus(); },
    stop() { running = false; },
    refresh: refreshStatus,
    setIncursion(v) { inc = v; },
    focus(id) { focusId = id; },
    labels: labelEls,
    benchmark() { return benchDone ? Promise.resolve({ ok: true, fps: 30 }) : new Promise((r) => { benchResolve = r; setTimeout(() => { if (!benchDone) { benchDone = true; r({ ok: false, fps: 0, intervalMs: 999, reason: 'timeout' }); } }, 9000); }); },
    onLost(fn) { onLost = fn; },
    info() { return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls }; },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
      renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('click', onClick);
      disposables.forEach((d) => d.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.();
      canvasHost.remove(); labelLayer.remove();
    },
  };
  const onVis = () => { if (!document.hidden) { last = performance.now(); acc = 0; } };
  document.addEventListener('visibilitychange', onVis);
  return api;
}
