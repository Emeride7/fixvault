/**
 * FixVault – supabaseClient.js
 * ─────────────────────────────────────────────
 * Configuration de la connexion Supabase.
 *
 * ➜ ÉTAPE 1 : Remplacer les deux valeurs ci-dessous
 *   par celles de votre projet Supabase.
 *   Vous les trouverez dans :
 *   Dashboard → Settings → API
 */

const SUPABASE_URL = 'https://VOTRE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';

/* ── Initialisation du client Supabase via CDN ── */
// Le SDK est chargé dynamiquement pour éviter un bundler.
(function loadSupabaseSDK() {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    // Créer le client global accessible par tous les modules
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[FixVault] Supabase client initialisé ✓');
    // Déclencher l'initialisation de l'app une fois le SDK prêt
    if (typeof window.initApp === 'function') window.initApp();
  };
  script.onerror = () => {
    console.error('[FixVault] Impossible de charger le SDK Supabase. Vérifiez votre connexion internet.');
    document.getElementById('loadingState').innerHTML =
      '<span class="state-icon">⚠</span><p>Erreur : impossible de charger le SDK Supabase.</p>';
  };
  document.head.appendChild(script);
})();
