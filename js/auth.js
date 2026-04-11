/**
 * FixVault – auth.js
 * ─────────────────────────────────────────────
 * Gestion de la session admin (Supabase Auth).
 * - Login / Logout via email + mot de passe
 * - Détection de la session existante
 * - Affichage conditionnel des boutons admin
 */

const Auth = (() => {

  let currentUser = null;

  /* ══════════════════════════════════════════
     INITIALISATION
  ═══════════════════════════════════════════ */

  async function init() {
    // Vérifier si une session existe déjà (refresh token)
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateUI();

    // Écouter les changements de session
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateUI();
    });
  }

  /* ══════════════════════════════════════════
     LOGIN
  ═══════════════════════════════════════════ */

  async function login(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email, password
    });

    if (error) {
      Toast.show('Identifiants incorrects.', 'error');
      return false;
    }

    currentUser = data.user;
    Toast.show('Connecté en tant qu\'administrateur ✓', 'success');
    updateUI();
    return true;
  }

  /* ══════════════════════════════════════════
     LOGOUT
  ═══════════════════════════════════════════ */

  async function logout() {
    await window.supabaseClient.auth.signOut();
    currentUser = null;
    Toast.show('Déconnecté.', 'info');
    updateUI();
  }

  /* ══════════════════════════════════════════
     ÉTAT
  ═══════════════════════════════════════════ */

  function isAdmin() {
    return !!currentUser;
  }

  function getUser() {
    return currentUser;
  }

  /* ══════════════════════════════════════════
     MISE À JOUR DE L'UI
     Affiche/masque les éléments réservés admin
  ═══════════════════════════════════════════ */

  function updateUI() {
    const admin = isAdmin();

    // Bouton login/logout dans la topbar
    const authBtn = document.getElementById('btnAuthToggle');
    if (authBtn) {
      authBtn.textContent = admin ? '⎋ Déconnexion' : '⚿ Admin';
      authBtn.classList.toggle('btn-admin-active', admin);
      authBtn.title = admin
        ? `Connecté : ${currentUser.email}`
        : 'Se connecter en tant qu\'administrateur';
    }

    // Indicateur de statut admin
    const badge = document.getElementById('adminBadge');
    if (badge) {
      badge.classList.toggle('hidden', !admin);
    }

    // Les boutons Modifier / Supprimer dans la modale détail
    // sont gérés directement dans modal.js via Auth.isAdmin()
  }

  return { init, login, logout, isAdmin, getUser };
})();
