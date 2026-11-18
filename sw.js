/* Bump the version whenever the app shell or the local catalog changes. */
const CACHE = 'monster-app-v1';
const ROOT = new URL('./', self.location.href);
const HOME = new URL('index.html', ROOT).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(new URL('offline-assets.json', ROOT), { cache: 'no-store' });
    if (!response.ok) throw new Error('Offline asset list unavailable');
    const assets = await response.json();
    const cache = await caches.open(CACHE);
    await cache.addAll(assets.map(asset => new Request(new URL(asset, ROOT), { cache: 'reload' })));
    // Updates take over on the next app launch, keeping an open session consistent.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('monster-app-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      const home = await cache.match(HOME);
      if (home) return home;
      return fetch(event.request);
    }
    return (await cache.match(event.request)) || fetch(event.request);
  })());
});
