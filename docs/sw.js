/* GALACTUS PWA Build 9: backend integration and app-shell caching. */
const CACHE_NAME = 'galactus-pwa-build-0.9';
const BASE_URL = self.registration.scope;
const SHELL_PATHS = [
  '', 'index.html', 'offline.html', 'styles.css', 'app.js',
  'runtime.js', 'manifest.webmanifest', 'icon.svg'
];
const SHELL_URLS = SHELL_PATHS.map(path => new URL(path, BASE_URL).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(SHELL_URLS.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      await cache.put(url, response);
    }));
    // index.html is required for the shell to be considered installed.
    const indexUrl = new URL('index.html', BASE_URL).href;
    if (!await cache.match(indexUrl)) {
      const failures = results.filter(r => r.status === 'rejected').length;
      throw new Error(`App shell install failed: index.html missing (${failures} asset fetch failures)`);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('galactus-pwa-build-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const index = await caches.match(new URL('index.html', BASE_URL).href);
        if (index) return index;
        const offline = await caches.match(new URL('offline.html', BASE_URL).href);
        if (offline) return offline;
        return new Response('GALACTUS is offline and its app shell is not cached yet.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      return new Response('Offline: this resource is not cached yet.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
