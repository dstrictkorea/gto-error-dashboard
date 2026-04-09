// ═══════════════════════════════════════════
// D'strict GTO-EN — Service Worker (scope: /en)
// PWA Offline + Cache Strategy + Update Notify
// ═══════════════════════════════════════════

const CACHE_VERSION = 'v5.6.0-en-Apr2026';
const CACHE_STATIC = 'gto-en-static-' + CACHE_VERSION;
const CACHE_DYNAMIC = 'gto-en-dynamic-' + CACHE_VERSION;
const CACHE_CDN = 'gto-en-cdn-' + CACHE_VERSION;

const APP_SHELL = [
  '/en',
  '/index.html',
  '/css/style.css',
  '/js/utils.js',
  '/js/data.js',
  '/js/daily.js',
  '/js/monthly.js',
  '/js/incidents.js',
  '/js/branches.js',
  '/js/search.js',
  '/js/nav.js',
  '/js/mobile-app.js',
  '/css/mobile-app.css',
  '/js/matching.js',
  '/js/report.js',
  '/js/i18n.js',
  '/js/translate.js',
  '/js/ai.js',
  '/fonts/dstrict_CI_BLACK.png',
  '/fonts/icon-192.png',
  '/fonts/icon-512.png',
  '/en/manifest.json'
];

const CDN_PATTERNS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

// ══════════ INSTALL ══════════
self.addEventListener('install', event => {
  console.log('[SW-EN] Installing ' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(err => console.warn('[SW-EN] Cache fail:', url, err.message)))
      ))
      .then(() => self.skipWaiting())
  );
});

// ══════════ ACTIVATE ══════════
self.addEventListener('activate', event => {
  console.log('[SW-EN] Activating ' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('gto-en-') && !k.includes(CACHE_VERSION)).map(k => caches.delete(k)))
    )
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll().then(clients =>
      clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }))
    ))
  );
});

// ══════════ FETCH ══════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;
  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }
  if (CDN_PATTERNS.some(p => url.hostname.includes(p))) {
    event.respondWith(cacheFirstCDN(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }
  event.respondWith(networkFirstStatic(request));
});

async function networkOnly(request) {
  try { return await fetch(request); }
  catch (e) { return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
}

async function cacheFirstCDN(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) { const c = await caches.open(CACHE_CDN); c.put(request, res.clone()); }
    return res;
  } catch (e) { return new Response('', { status: 504 }); }
}

async function networkFirstNav(request) {
  try {
    const res = await fetch(request);
    if (res.ok) { const c = await caches.open(CACHE_STATIC); c.put(request, res.clone()); }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const idx = await caches.match('/index.html');
    if (idx) return idx;
    return offlinePage();
  }
}

async function networkFirstStatic(request) {
  try {
    const res = await fetch(request);
    if (res.ok) { const c = await caches.open(CACHE_DYNAMIC); c.put(request, res.clone()); }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 504 });
  }
}

function offlinePage() {
  return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GTO-EN Offline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,'Pretendard',sans-serif;background:#f6f5f0;color:#1a1a18;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#fff;border-radius:20px;padding:48px 36px;max-width:400px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.06)}.icon{font-size:56px;margin-bottom:20px}h1{font-size:22px;font-weight:800;margin-bottom:8px;color:#534AB7}p{font-size:14px;color:#73726c;line-height:1.6;margin-bottom:24px}.btn{display:inline-block;padding:14px 32px;background:#534AB7;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer}</style></head><body><div class="card"><div class="icon">📡</div><h1>You're Offline</h1><p>Please check your network and try again.</p><button class="btn" onclick="location.reload()">↻ Retry</button></div></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ══════════ BACKGROUND SYNC / PUSH ══════════
self.addEventListener('periodicsync', event => {
  if (event.tag === 'sync-error-data') {
    event.waitUntil(fetch('/api/daily-summary').then(r => r.json()).catch(() => {}));
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(caches.open(CACHE_DYNAMIC).then(c => c.keys().then(reqs =>
      Promise.allSettled(reqs.map(r => fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; })))
    )));
  }
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "d'strict GTO-EN Alert", {
    body: data.body || 'New error reported', icon: '/fonts/icon-192.png', badge: '/fonts/icon-96.png',
    tag: 'error-en', data: { url: data.url || '/en' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data.url || '/en';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(wc => {
    for (const c of wc) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
