// Tiny pub/sub store.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      subs.forEach((f) => f(state));
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
}
export const events = new EventTarget();
export const emit = (name, detail) => events.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => { const h = (e) => fn(e.detail); events.addEventListener(name, h); return () => events.removeEventListener(name, h); };
