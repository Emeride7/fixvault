/**
 * FixVault – auth.js
 * ─────────────────────────────────────────────
 * Gestion de la session admin (Supabase Auth).
 */

const Auth = (() => {
  let currentUser = null;

  async function init() {
    if (!window.supabaseClient) return;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateUI();

    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateUI();
    });
  }

  async function login(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      Toast.show('Identifiants incorrects.', 'error');
      return false;
    }
    currentUser = data.user;
    Toast.show('Connecté en tant qu\'administrateur ✓', 'success');
    updateUI();
    return true;
  }

  async function logout() {
    await window.supabaseClient.auth.signOut();
    currentUser = null;
    Toast.show('Déconnecté.', 'info');
    updateUI();
  }

  function isAdmin() {
    return !!currentUser;
  }

  function getUser() {
    return currentUser;
  }

  function updateUI() {
    const admin = isAdmin();
    const authBtn = document.getElementById('btnAuthToggle');
    if (authBtn) {
      authBtn.innerHTML = admin ? '⎋ <span>Déconnexion</span>' : '⚿ <span>Admin</span>';
      authBtn.classList.toggle('btn-admin-active', admin);
      authBtn.title = admin ? `Connecté : ${currentUser.email}` : 'Se connecter';
    }
    const badge = document.getElementById('adminBadge');
    if (badge) badge.classList.toggle('hidden', !admin);
    const adminSection = document.getElementById('adminCategoriesSection');
    if (adminSection) adminSection.style.display = admin ? 'block' : 'none';
  }

  return { init, login, logout, isAdmin, getUser };
})();
