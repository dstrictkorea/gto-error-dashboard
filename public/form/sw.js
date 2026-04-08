// d'strict Error Report — Service Worker v1.0
const CACHE_NAME = 'error-report-v1.0';
const SHELL = [
  '/form/',
  '/form/index.html',
  '/fonts/dstrict_CI_BLACK.png',
  '/fonts/dstrict_CI_WHITE.png',
  '/fonts/icon-192.png',
  '/fonts/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
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
  const url = new URL(e.request.url);
  // Microsoft Form requests — always network (don't cache external form)
  if (!url.pathname.startsWith('/form') && !url.pathname.startsWith('/fonts')) {
    return;
  }
  // App shell — network first, cache fallback
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
