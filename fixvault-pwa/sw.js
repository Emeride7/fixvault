/**
 * FixVault – Service Worker
 * Cache-first strategy pour offline complet
 */

const CACHE_NAME = 'fixvault-v1';
const STATIC_ASSETS = [
  '/fixvault/',
  '/fixvault/index.html',
  '/fixvault/css/style.css',
  '/fixvault/js/supabaseClient.js',
  '/fixvault/js/cache.js',
  '/fixvault/js/categories.js',
  '/fixvault/js/auth.js',
  '/fixvault/js/search.js',
  '/fixvault/js/modal.js',
  '/fixvault/js/dashboard.js',
  '/fixvault/js/app.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// Install : cache les assets statiques
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('[SW] Cache failed:', err))
  );
});

// Activate : nettoie les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch : cache-first pour les assets, network-first pour l'API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API Supabase → network-first avec fallback cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets statiques → cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Background sync pour les actions en offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-solutions') {
    console.log('[SW] Background sync triggered');
    // Les données en attente sont gérées par Cache.js dans le client
  }
});

// Push notifications (prêt pour plus tard)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'FixVault', {
      body: data.body || 'Nouvelle mise à jour',
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-72x72.png'
    })
  );
});
