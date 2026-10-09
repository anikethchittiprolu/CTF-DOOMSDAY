/* DOOMSDAY service worker. Caches the game's static assets so event day only needs small JSON calls.
   Served from the site root as /doom-sw.js by the ctfd-doom plugin (Service-Worker-Allowed: /). */
const VERSION = 'doom-v1';
const CACHE = VERSION + '-assets';
const STATIC = '/themes/doomsday/static/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'precache') e.waitUntil(precache(e.data.urls, e.source));
  if (e.data && e.data.type === 'status') e.waitUntil(status(e.data.urls, e.source));
});

async function precache(urls, client) {
  const cache = await caches.open(CACHE);
  let done = 0, failed = 0;
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { cache: 'reload' });
          if (!res.ok) throw new Error(res.status);
          await cache.put(url, res);
        }
      } catch (err) { failed++; }
      done++;
      if (client) client.postMessage({ type: 'progress', done, total: urls.length, failed });
    }
  };
  await Promise.all([worker(), worker(), worker()]); // gentle on a weak connection
  if (client) client.postMessage({ type: 'done', done, total: urls.length, failed });
}
async function status(urls, client) {
  const cache = await caches.open(CACHE);
  let have = 0;
  for (const u of urls) if (await cache.match(u)) have++;
  client.postMessage({ type: 'status', have, total: urls.length });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Hashed build assets never change, so cache first. Everything else goes to the network.
  if (url.origin === location.origin && url.pathname.startsWith(STATIC + 'assets/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
  }
});
