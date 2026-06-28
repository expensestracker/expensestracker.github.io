/* ============================================================
   service-worker.js — Activity Log PWA
   Strategy:
   - App shell (HTML, icons)  → Cache-first, update in background
   - Firebase JS SDK CDN      → Cache-first (versioned URLs, safe)
   - Firebase Realtime DB API → Network-only (live data, no cache)
   ============================================================ */

const CACHE_NAME    = 'activity-log-v1';
const RUNTIME_CACHE = 'activity-log-runtime-v1';

// Files that make up the app shell
const PRECACHE_URLS = [
  '/notes/index.html',
  '/notes/manifest.json',
  '/notes/logo-192.png',
  '/notes/logo-512.png'
];

// Firebase SDK base URL — cache all requests to this origin
const FIREBASE_SDK_ORIGIN = 'https://www.gstatic.com';

// Firebase Realtime Database origin — always network-only
const FIREBASE_DB_HOST = 'firebasedatabase.app';

// ── Install: pre-cache app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

// ── Activate: purge old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())  // take control right away
  );
});

// ── Fetch: route by request type ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET requests (POST/PUT/DELETE to Firebase)
  if (request.method !== 'GET') return;

  // 2. Skip Firebase Realtime Database — must be live
  if (url.hostname.includes(FIREBASE_DB_HOST)) return;

  // 3. Firebase Auth & Firestore API — skip
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('/firestore')) return;

  // 4. Firebase SDK from gstatic — cache-first (URLs are content-hashed)
  if (url.origin === FIREBASE_SDK_ORIGIN) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // 5. App shell & same-origin assets — cache-first, revalidate in BG
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 6. Everything else — network only
});

// ── Strategies ───────────────────────────────────────────────

/** Cache-first: serve from cache; fetch & update cache on miss. */
async function cacheFirst(request, cacheName = RUNTIME_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached — nothing we can do
    return new Response('Offline — resource not cached.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Stale-while-revalidate: serve cached version immediately,
 * then fetch fresh copy and update the cache in the background.
 * Falls back to network if nothing is cached yet.
 */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Kick off a background network fetch regardless
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);   // swallow network errors silently

  // Return cached immediately; otherwise wait for network
  return cached || fetchPromise || offlineFallback();
}

/** Minimal offline fallback page (only shown when index.html isn't cached) */
function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — Activity Log</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      height: 100dvh; margin: 0; background: #f1f5f9; color: #0f172a;
      text-align: center; padding: 24px;
    }
    h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 8px; }
    p  { font-size: 0.9rem; color: #64748b; }
  </style>
</head>
<body>
  <div>
    <h1>You're offline</h1>
    <p>Connect to the internet to load Activity Log.</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
