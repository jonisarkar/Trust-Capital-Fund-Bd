const CACHE_NAME = 'arafat-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/sidebar.css',
  './css/dashboard.css',
  './css/tables.css',
  './css/modals.css',
  './js/db.js',
  './js/auth.js',
  './js/app.js',
  './js/members.js',
  './js/payments.js',
  './js/dashboard.js',
  './js/history.js',
  './js/export.js',
  './js/import.js',
  './js/settings.js',
  './lib/dexie.min.js',
  './lib/chart.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return response;
    }))
  );
});
