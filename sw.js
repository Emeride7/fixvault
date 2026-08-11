/**
 * FixVault – Service Worker
 * Cache-first strategy pour GitHub Pages (/fixvault/)
 */

const CACHE_NAME = 'fixvault-v3';
const BASE = '/fixvault/';

const STATIC_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'css/style.css',
  BASE + 'js/supabaseClient.js',
  BASE + 'js/cache.js',
  BASE + 'js/categories.js',
  BASE + 'js/auth.js',
  BASE + 'js/search.js',
  BASE + 'js/modal.js',
  BASE + 'js/dashboard.js',
  BASE + 'js/app.js',
  BASE + 'manifest.json',
  BASE + 'icons/icon-72x72.png',
  BASE + 'icons/icon-96x96.png',
  BASE + 'icons/icon-128x128.png',
  BASE + 'icons/icon-144x144.png',
  BASE + 'icons/icon-152x152.png',
  BASE + 'icons/icon-192x192.png',
  BASE + 'icons/icon-384x384.png',
  BASE + 'icons/icon-512x512.png',
  BASE + 'screenshots/screen1.png',
  BASE + 'screenshots/screen2.png',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install v3');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('[SW] Cache failed:', err))
  );
});

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API Supabase → network-first
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
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match(BASE + 'index.html');
        }
      });
    })
  );
});
