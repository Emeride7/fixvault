/**
 * FixVault – Service Worker
 * ─────────────────────────────────────────────
 * Stratégie : Cache-first pour les assets statiques
 *             Network-first pour les données Supabase
 */

const CACHE_NAME    = 'fixvault-v1';
const CACHE_ASSETS  = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/search.js',
  './js/modal.js',
  './js/supabaseClient.js',
  './manifest.json',
  // Polices Google
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap',
  // SDK Supabase
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

/* ── Installation : mise en cache des assets ── */
self.addEventListener('install', event => {
  console.log('[SW] Installation…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Mise en cache des assets statiques');
      return cache.addAll(CACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ── Activation : suppression des anciens caches ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activation…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

/* ── Interception des requêtes ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requêtes Supabase → Network-first (données fraîches)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Tout le reste → Cache-first (assets statiques)
  event.respondWith(cacheFirst(event.request));
});

/* ── Stratégie Cache-first ── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Hors ligne et pas en cache → page offline basique
    return new Response(
      '<h1 style="font-family:monospace;color:#00e5a0;padding:2rem">FixVault – Mode hors ligne</h1><p style="font-family:monospace;padding:0 2rem;color:#8891a8">Reconnectez-vous pour synchroniser les données.</p>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/* ── Stratégie Network-first ── */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Hors ligne' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}
