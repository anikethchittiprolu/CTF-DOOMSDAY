import { config } from './config.js';
import { backoff } from './lib/clock.js';
import { emit } from './lib/bus.js';

export const net = { online: true, failures: 0, lastOk: Date.now() };

export class NetError extends Error {
  constructor(msg, kind) { super(msg); this.kind = kind; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mockHandler = null;
export const installMock = (h) => { mockHandler = h; };

function mark(ok) {
  const was = net.online;
  net.online = ok;
  net.failures = ok ? 0 : net.failures + 1;
  if (ok) net.lastOk = Date.now();
  if (was !== ok) emit('net', { online: ok });
}

/**
 * One JSON request. Small calls only. Resolves to { ok, status, json }.
 * Throws NetError when nothing came back (offline, timeout, bad body).
 * GET requests retry with backoff and jitter; POSTs never retry on their own.
 */
export async function request(path, { method = 'GET', body, timeout = config.requestTimeoutMs, retries = method === 'GET' ? 2 : 0 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      const res = await once(path, method, body, timeout);
      mark(true);
      return res;
    } catch (e) {
      mark(false);
      if (attempt >= retries) throw e;
      await sleep(backoff(600, attempt++));
    }
  }
}

async function once(path, method, body, timeout) {
  if (mockHandler) {
    const r = await mockHandler(method, path, body);
    if (r.networkError) throw new NetError('mock network failure', 'network');
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: r.json };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') headers['CSRF-Token'] = config.nonce;
    const r = await fetch(config.root + path, {
      method, headers, credentials: 'same-origin', signal: ctl.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await r.json(); } catch { if (r.status < 500 && r.status !== 429) throw new NetError('bad response', 'parse'); }
    if (r.status >= 502 && r.status <= 504) throw new NetError('server unavailable', 'server');
    return { ok: r.ok, status: r.status, json };
  } catch (e) {
    if (e instanceof NetError) throw e;
    throw new NetError(e.name === 'AbortError' ? 'timeout' : 'network', e.name === 'AbortError' ? 'timeout' : 'network');
  } finally { clearTimeout(timer); }
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => mark(false));
  window.addEventListener('online', () => emit('net', { online: true, hint: true }));
}
