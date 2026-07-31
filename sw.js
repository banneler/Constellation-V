// Bump this whenever the runtime JS/CSS surface changes in a way that an
// existing client MUST receive on next load. The `activate` handler below
// deletes any caches whose key doesn't match the current STATIC_CACHE or
// RUNTIME_CACHE, so a version bump effectively evicts everything the SW
// had stored under the previous label. (The old `constellation-v1` caches
// were pinning the pre-cd9c20d `account-plan-export-templates.js` — the
// one with the backticks-in-CSS-comment bug — on every client even after
// the fix shipped, because the SW intercepts script requests with a
// stale-while-revalidate policy.)
const CACHE_VERSION = 'constellation-v103';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SCOPE_URL = new URL(self.registration.scope);
const PRECACHE_PATHS = [
    'index.html',
    'output.css',
    'css/command-center.css',
    'manifest.json',
    'assets/constellation-logo-c.svg',
    'assets/constellation-logo-full.svg'
];
const PRECACHE_URLS = PRECACHE_PATHS.map((path) => new URL(path, SCOPE_URL).toString());

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE);
            await Promise.all(
                PRECACHE_URLS.map(async (url) => {
                    try {
                        await cache.add(url);
                    } catch (_) {
                        // Skip files that cannot be precached in this environment.
                    }
                })
            );
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key.startsWith('constellation-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
                    .map((key) => caches.delete(key))
            );
            await self.clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // App shell navigation: network first, fall back to cached index.
    if (request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(request);
                    const runtimeCache = await caches.open(RUNTIME_CACHE);
                    runtimeCache.put(request, networkResponse.clone());
                    return networkResponse;
                } catch (_) {
                    const runtimeCache = await caches.open(RUNTIME_CACHE);
                    const cachedPage = await runtimeCache.match(request);
                    if (cachedPage) return cachedPage;
                    const staticCache = await caches.open(STATIC_CACHE);
                    return (await staticCache.match(new URL('index.html', SCOPE_URL).toString()))
                        || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
                }
            })()
        );
        return;
    }

    // JS/CSS: network-first + bypass HTTP disk cache. Plain fetch(request) was still
    // able to return a browser-cached output.css after SW version bumps, so timeline
    // padding/height fixes looked like no-ops while page-specific CSS (insights) worked.
    if (request.destination === 'style' || request.destination === 'script') {
        event.respondWith(
            (async () => {
                const cache = await caches.open(RUNTIME_CACHE);
                try {
                    const networkResponse = await fetch(request, { cache: 'reload' });
                    if (networkResponse && networkResponse.ok) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (_) {
                    const cached = await cache.match(request);
                    return cached || new Response('', { status: 504 });
                }
            })()
        );
        return;
    }

    // Images/fonts/manifest: stale-while-revalidate.
    if (
        request.destination === 'image' ||
        request.destination === 'font' ||
        request.destination === 'manifest'
    ) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(RUNTIME_CACHE);
                const cached = await cache.match(request);
                const networkFetch = fetch(request)
                    .then((response) => {
                        if (response && response.ok) cache.put(request, response.clone());
                        return response;
                    })
                    .catch(() => null);
                if (cached) return cached;
                const networkResponse = await networkFetch;
                return networkResponse || new Response('', { status: 504 });
            })()
        );
    }
});
