/**
 * FixVault – Service Worker (optimisé pour démarrage rapide)
 */

const CACHE_NAME = 'fixvault-v4';
const BASE = '/fixvault/';

// Assets CRITIQUES (affichage immédiat)
const CRITICAL_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'css/style.css',
  BASE + 'js/supabaseClient.js',
  BASE + 'js/cache.js',
  BASE + 'js/categories.js',
  BASE + 'js/auth.js',
  BASE + 'js/search.js',
  BASE + 'js/modal.js',
  BASE + 'js/app.js',
  BASE + 'manifest.json'
];

// Assets secondaires (mis en cache en arrière-plan)
const LAZY_ASSETS = [
  BASE + 'js/dashboard.js',
  BASE + 'icons/icon-192x192.png',
  BASE + 'icons/icon-512x512.png',
  BASE + 'screenshots/screen1.png',
  BASE + 'screenshots/screen2.png',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install v4 (fast)');
  self.skipWaiting();

  // Cache CRITIQUE uniquement pendant l'install (rapide)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CRITICAL_ASSETS);
    }).then(() => {
      console.log('[SW] Critical assets cached');
      // Cache lazy en arrière-plan sans bloquer
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_READY' }));
      });
    }).catch(err => console.warn('[SW] Critical cache failed:', err))
  );

  // Cache les assets secondaires APRÈS l'install
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        LAZY_ASSETS.map(url => 
          fetch(url, { mode: 'no-cors' }).then(r => cache.put(url, r)).catch(() => {})
        )
      );
    }).then(() => console.log('[SW] Lazy assets cached'))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Stratégie : Stale-While-Revalidate pour les assets (affiche immédiatement, met à jour en fond)
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});
