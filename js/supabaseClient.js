/**
 * FixVault – supabaseClient.js
 * ─────────────────────────────────────────────
 * Configuration de la connexion Supabase.
 *
 * ➜ Remplacer les deux valeurs ci-dessous par celles de votre projet.
 * Dashboard → Settings → API
 */

const SUPABASE_URL = 'https://VOTRE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';

/* ── Initialisation du client Supabase via CDN ── */
(function loadSupabaseSDK() {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    if (SUPABASE_URL.includes('VOTRE_PROJECT_ID')) {
      console.error('[FixVault] ⚠️ Vous devez configurer SUPABASE_URL et SUPABASE_ANON_KEY dans js/supabaseClient.js');
      document.getElementById('loadingState').innerHTML = `
        <div class="state-icon">⚠</div>
        <p>Supabase non configuré.</p>
        <p style="font-size:0.75rem">Remplacez les placeholders dans js/supabaseClient.js</p>
      `;
      document.getElementById('loadingState').classList.remove('hidden');
      return;
    }
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[FixVault] Supabase client initialisé ✓');
    if (typeof window.initApp === 'function') window.initApp();
  };
  script.onerror = () => {
    console.error('[FixVault] Impossible de charger le SDK Supabase.');
    document.getElementById('loadingState').innerHTML = `
      <div class="state-icon">⚠</div>
      <p>Erreur : impossible de charger le SDK Supabase.</p>
    `;
  };
  document.head.appendChild(script);
})();
