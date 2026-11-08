/* ═══════════════════════════════════════════════
   Diana's Sudoku - Service Worker (PWA)
   ═══════════════════════════════════════════════ */

// Kept in sync with package.json by scripts/sync-version.mjs.
// Changing it renames the cache, so each release drops the previous offline copy.
const APP_VERSION = '1.3.0';
const CACHE_NAME = `dianas-sudoku-v${APP_VERSION}`;
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/game.js',
  '/version.js',
  '/manifest.json',
  '/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS.filter(a => !a.startsWith('http')));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});
