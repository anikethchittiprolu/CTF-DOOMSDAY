// Harmless per-browser preferences only. Nothing that matters is stored here.
const KEY = 'doom.prefs.v1';
const DEFAULTS = { mode: 'auto', master: 0.6, music: 0.5, sfx: 0.8, muted: false, reducedMotion: null, bigText: false, seenBoot: {} };
let cache = null;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export function prefs() { return cache ??= { ...DEFAULTS, ...read() }; }
export function setPref(k, v) {
  cache = { ...prefs(), [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private window: fine */ }
  return cache;
}
export const prefersReducedMotion = () => {
  const p = prefs().reducedMotion;
  if (p !== null) return p;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
};
