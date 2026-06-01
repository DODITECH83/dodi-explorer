/**
 * DODI Explorer — Service Worker
 * Developed by Adry Doditech
 * Enables PWA offline functionality and caching
 */

const CACHE_NAME = 'dodi-explorer-v1.0';
const STATIC_CACHE = 'dodi-static-v1';
const DYNAMIC_CACHE = 'dodi-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Leaflet from CDN — cache these too
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap',
];

// ============================================================
// INSTALL — Cache static assets
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing DODI Explorer...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        // Cache what we can, ignore failures for external CDN
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(e => console.warn('[SW] Could not cache:', url, e))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — Clean old caches
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating DODI Explorer...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Cache strategies
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Overpass API — network only (never cache map data)
  if (url.hostname.includes('overpass-api.de')) {
    event.respondWith(fetch(request));
    return;
  }

  // Wikipedia API — network first with dynamic cache
  if (url.hostname.includes('wikipedia.org')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Map tiles (OpenStreetMap / CartoCDN) — cache first
  if (url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('openstreetmap.org')) {
    event.respondWith(cacheFirst(request, 500));
    return;
  }

  // Static assets — cache first
  event.respondWith(cacheFirst(request));
});

// ============================================================
// CACHE STRATEGIES
// ============================================================

/**
 * Cache First — good for static assets and map tiles
 */
async function cacheFirst(request, maxItems = 100) {
  const cache = await caches.open(
    request.url.includes('cartocdn') ? 'dodi-tiles-v1' : STATIC_CACHE
  );
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      // Limit cache size
      limitCacheSize('dodi-tiles-v1', maxItems);
    }
    return response;
  } catch {
    return new Response('Offline — risorsa non disponibile', { status: 503 });
  }
}

/**
 * Network First — good for dynamic API responses
 */
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Limit cache to N items (remove oldest)
 */
async function limitCacheSize(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
    limitCacheSize(cacheName, max);
  }
}

// ============================================================
// BACKGROUND SYNC (for offline saved places)
// ============================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

async function syncFavorites() {
  console.log('[SW] Syncing favorites in background...');
}

// ============================================================
// PUSH NOTIFICATIONS (future feature)
// ============================================================
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Nuovo luogo interessante vicino a te!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'DODI Explorer', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
