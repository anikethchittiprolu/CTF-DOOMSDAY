// Procedural audio. Nothing is downloaded and nothing blocks gameplay: the context only
// starts after the first click on the boot screen.
import { prefs } from '../lib/prefs.js';

let ctx = null, master, musicBus, sfxBus, ambBus, noiseBuf;
let layers = null, ambient = null, region = null, incursion = 0;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; }
  return noiseBuf;
}
const src = () => { const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true; return s; };

function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

function tone(freq, { type = 'sine', at = 0, a = 0.005, d = 0.15, peak = 0.3, slide = 0, bus = sfxBus } = {}) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + a + d);
  env(g, t, a, peak, d); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + d + 0.05);
}
function burst({ at = 0, d = 0.2, peak = 0.3, f0 = 800, f1 = 200, q = 1, type = 'bandpass' } = {}) {
  const t = ctx.currentTime + at, s = src(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + d);
  env(g, t, 0.01, peak, d); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + d + 0.05);
}

const SFX = {
  click: () => tone(1500, { type: 'square', d: 0.03, peak: 0.08 }),
  open: () => { tone(300, { type: 'triangle', slide: 400, d: 0.18, peak: 0.18 }); tone(900, { at: 0.1, d: 0.08, peak: 0.06 }); },
  talk: () => { for (let i = 0; i < 4; i++) tone(160 + Math.random() * 120, { type: 'sawtooth', at: i * 0.07, d: 0.05, peak: 0.05 }); },
  correct: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.09, d: 0.25, peak: 0.2 })),
  wrong: () => { tone(140, { type: 'sawtooth', d: 0.28, peak: 0.22, slide: -60 }); burst({ d: 0.2, peak: 0.12, f0: 2500, f1: 300 }); },
  lockdown: () => { tone(220, { type: 'square', d: 0.6, peak: 0.2, slide: -170 }); burst({ at: 0.1, d: 0.5, peak: 0.2, f0: 400, f1: 60, type: 'lowpass' }); },
  servo: () => burst({ d: 0.25, peak: 0.12, f0: 600, f1: 2400, q: 6 }),
  whoosh: () => burst({ d: 0.5, peak: 0.2, f0: 300, f1: 3000, q: 0.7 }),
  badge: () => [392, 523, 659, 784, 988].forEach((f, i) => tone(f, { type: 'sine', at: i * 0.07, d: 0.4, peak: 0.16 })),
  alert: () => { tone(880, { type: 'square', d: 0.08, peak: 0.1 }); tone(660, { at: 0.12, type: 'square', d: 0.1, peak: 0.1 }); },
};

export const audio = {
  get ready() { return !!ctx; },
  init() {
    if (ctx) { ctx.state === 'suspended' && ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master); ambBus.connect(master); master.connect(ctx.destination);
      this.applyVolumes(); startMusic(); this.setRegion(region);
    } catch { ctx = null; }
  },
  applyVolumes() {
    if (!ctx) return;
    const p = prefs(); const t = ctx.currentTime;
    master.gain.setTargetAtTime(p.muted ? 0 : p.master, t, 0.05);
    musicBus.gain.setTargetAtTime(p.music * 0.5, t, 0.05); sfxBus.gain.setTargetAtTime(p.sfx, t, 0.05); ambBus.gain.setTargetAtTime(p.music * 0.7, t, 0.05);
  },
  sfx(name) { if (ctx && !prefs().muted && SFX[name]) SFX[name](); },
  setIncursion(v) { incursion = v; if (layers) setLayers(); },
  setRegion(id) {
    region = id;
    if (!ctx) return;
    const old = ambient; ambient = id ? makeAmbient(id) : null;
    if (old) { old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5); setTimeout(() => old.stop(), 2500); }
  },
};

function startMusic() {
  const mk = (build) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus); build(g); return g; };
  const calm = mk((g) => [110, 164.8, 220, 329.6].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = i * 3; const og = ctx.createGain(); og.gain.value = 0.12; o.connect(og); og.connect(g); o.start(); }));
  const tension = mk((g) => { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.connect(g); [55, 55.7, 82.4].forEach((fr) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); }); const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15; const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); });
  const crisis = mk((g) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 49; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; const am = ctx.createGain(); am.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 2.2; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain); o.connect(lp); lp.connect(am); am.connect(g); o.start(); lfo.start(); const t = ctx.createOscillator(); t.type = 'sine'; t.frequency.value = 369.9; const tg = ctx.createGain(); tg.gain.value = 0.05; t.connect(tg); tg.connect(g); t.start(); });
  layers = { calm, tension, crisis };
  setLayers();
}
function setLayers() {
  const t = ctx.currentTime, i = incursion;
  layers.calm.gain.setTargetAtTime(clamp(1 - i * 1.3) * 0.5, t, 1.5);
  layers.tension.gain.setTargetAtTime(clamp(1 - Math.abs(i - 0.5) * 2.4) * 0.6, t, 1.5);
  layers.crisis.gain.setTargetAtTime(clamp((i - 0.55) * 2.2) * 0.55, t, 1.5);
}

const BEDS = {
  doomstadt: { wind: 500, hum: 60 }, embassy: { hum: 90, tick: 0.5 }, foundry: { hum: 55, wind: 250, crackle: 0.6 }, archives: { wind: 300, crackle: 0.3 },
  haasenstadt: { wind: 600, crackle: 0.9 }, monastery: { wind: 1400, snow: 1 }, wundagore: { wind: 900, hum: 73 }, baxter: { hum: 120, tick: 0.3 },
  timeplatform: { tick: 1, hum: 40 }, citadel: { wind: 350, hum: 45, crackle: 0.2 },
};
function makeAmbient(id) {
  const bed = BEDS[id] || BEDS.doomstadt;
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ambBus); gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.8);
  const stops = [];
  if (bed.wind) { const s = src(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = bed.wind; f.Q.value = 0.5; g.gain.value = 0.35; const l = ctx.createOscillator(); l.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = bed.wind * 0.4; l.connect(lg); lg.connect(f.frequency); l.start(); s.connect(f); f.connect(g); g.connect(gain); s.start(); stops.push(() => { s.stop(); l.stop(); }); }
  if (bed.hum) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = bed.hum; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; const g = ctx.createGain(); g.gain.value = 0.18; o.connect(f); f.connect(g); g.connect(gain); o.start(); stops.push(() => o.stop()); }
  if (bed.snow) { const s = src(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 3000; g.gain.value = 0.08; s.connect(f); f.connect(g); g.connect(gain); s.start(); stops.push(() => s.stop()); }
  const timers = [];
  if (bed.crackle) timers.push(setInterval(() => { if (Math.random() < bed.crackle) { const t = ctx.currentTime, s = src(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.connect(f); f.connect(g); g.connect(gain); s.start(t); s.stop(t + 0.06); } }, 220));
  if (bed.tick) timers.push(setInterval(() => { const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(0.05 * bed.tick, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03); o.connect(g); g.connect(gain); o.start(t); o.stop(t + 0.05); }, 1000));
  return { gain, stop() { timers.forEach(clearInterval); stops.forEach((f) => { try { f(); } catch { /* already stopped */ } }); gain.disconnect(); } };
}
