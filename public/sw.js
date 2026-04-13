// ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═??
// D'strict Error Dashboard ??Service Worker v5.4
// PWA Offline + Cache Strategy + Update Notify
// ?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═?�═??

// Cache versioning: update this when assets change to bust old caches
// Format: YYYY.MM.DD or semantic v#.#.#
const CACHE_VERSION = 'v5.7.2-b-Apr2026';
const CACHE_STATIC = 'dstrict-static-' + CACHE_VERSION;
const CACHE_DYNAMIC = 'dstrict-dynamic-' + CACHE_VERSION;
const CACHE_CDN = 'dstrict-cdn-' + CACHE_VERSION;

// ?�?� Core static assets (App Shell) ?�?�
const APP_SHELL = [
  '/',
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
  '/manifest.json'
];

// ?�?� CDN assets (cached separately, longer TTL) ?�?�
const CDN_PATTERNS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com'
];

// ?�═?�═?�═?�═?�═ INSTALL ?�═?�═?�═?�═?�═
self.addEventListener('install', event => {
  console.log('[SW] Installing ' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        // Cache app shell (allow individual failures)
        return Promise.allSettled(
          APP_SHELL.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ?�═?�═?�═?�═?�═ ACTIVATE ?�═?�═?�═?�═?�═
self.addEventListener('activate', event => {
  console.log('[SW] Activating ' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => !k.includes(CACHE_VERSION))
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    })
    .then(() => self.clients.claim())
    .then(() => {
      // Notify all clients that a new version is active
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// ?�═?�═?�═?�═?�═ FETCH STRATEGIES ?�═?�═?�═?�═?�═
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ?�?� Strategy 1: API calls ??Network Only (data must be live) ?�?�
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnlyWithOfflineFallback(request));
    return;
  }

  // ?�?� Strategy 2: CDN resources ??Cache First (long-lived) ?�?�
  if (CDN_PATTERNS.some(p => url.hostname.includes(p))) {
    event.respondWith(cacheFirstCDN(request));
    return;
  }

  // ?�?� Strategy 3: Navigation requests ??Network First with offline page ?�?�
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // ?�?� Strategy 4: Static assets ??Network First (ensure fresh content) ?�?�
  event.respondWith(networkFirstStatic(request));
});

// ?�?� Network Only with offline JSON fallback (API) ?�?�
async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch (err) {
    // API offline ??return error JSON
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Network unavailable. Please check your connection.',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-SW-Offline': 'true'
        }
      }
    );
  }
}

// ?�?� Cache First for CDN (fonts, Chart.js, Pretendard CSS) ?�?�
async function cacheFirstCDN(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_CDN);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'CDN Unavailable' });
  }
}

// ?�?� Network First for navigation (HTML pages) ?�?�
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Try cached version
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback: cached index.html (SPA)
    const indexCached = await caches.match('/index.html');
    if (indexCached) return indexCached;

    // Last resort: offline page
    return offlinePage();
  }
}

// ?�?� Network First for static assets (CSS/JS always fresh) ?�?�
async function networkFirstStatic(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache_name = request.url.includes('/fonts/') ? CACHE_STATIC : CACHE_DYNAMIC;
      const cache = await caches.open(cache_name);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Network failed ??fall back to cache
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('', { status: 504 });
  }
}

// ?�?� Offline fallback page ?�?�
function offlinePage() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="theme-color" content="#534AB7">
      <title>D'strict Error Dashboard ??Offline</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
          background: #f6f5f0; color: #1a1a18;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; min-height: 100dvh;
          padding: 24px;
        }
        .card {
          background: #fff; border-radius: 20px; padding: 48px 36px;
          max-width: 400px; width: 100%; text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        .icon { font-size: 56px; margin-bottom: 20px; }
        h1 { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #534AB7; }
        p { font-size: 14px; color: #73726c; line-height: 1.6; margin-bottom: 24px; }
        .btn {
          display: inline-block; padding: 14px 32px;
          background: #534AB7; color: #fff; border: none;
          border-radius: 12px; font-size: 15px; font-weight: 700;
          cursor: pointer; text-decoration: none;
          transition: transform 0.15s, opacity 0.15s;
        }
        .btn:active { transform: scale(0.97); opacity: 0.9; }
        .status {
          margin-top: 20px; font-size: 11px; color: #a3a29c;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">?��</div>
        <h1>You're Offline</h1>
        <p>The dashboard requires an internet connection to load live error data from SharePoint. Please check your network and try again.</p>
        <button class="btn" onclick="location.reload()">??Retry Connection</button>
        <div class="status"><div class="dot"></div>No network connection</div>
      </div>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ?�═?�═?�═?�═?�═ PERIODIC BACKGROUND SYNC ?�═?�═?�═?�═?�═
self.addEventListener('periodicsync', event => {
  if (event.tag === 'sync-error-data') {
    event.waitUntil(
      fetch('/api/daily-summary')
        .then(res => res.json())
        .then(data => {
          console.log('[SW] Periodic sync: error data refreshed');
        })
        .catch(err => console.warn('[SW] Periodic sync failed:', err))
    );
  }
});

// ?�═?�═?�═?�═?�═ BACKGROUND SYNC ?�═?�═?�═?�═?�═
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(
      caches.open(CACHE_DYNAMIC).then(cache => {
        console.log('[SW] Background sync: retrying pending requests');
        return cache.keys().then(requests => {
          return Promise.allSettled(
            requests.map(req => fetch(req).then(res => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            }))
          );
        });
      })
    );
  }
});

// ?�═?�═?�═?�═?�═ PUSH NOTIFICATIONS ?�═?�═?�═?�═?�═
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "d'strict Error Alert";
  const options = {
    body: data.body || 'New error reported',
    icon: '/fonts/icon-192.png',
    badge: '/fonts/icon-96.png',
    tag: 'error-notification',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// ?�═?�═?�═?�═?�═ MESSAGE HANDLING ?�═?�═?�═?�═?�═
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(CACHE_DYNAMIC).then(cache => {
      urls.forEach(url => cache.add(url).catch(() => {}));
    });
  }
});
