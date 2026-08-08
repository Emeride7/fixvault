/**
 * FixVault – cache.js
 * ─────────────────────────────────────────────
 * Cache local pour consultation hors-ligne.
 */

const Cache = (() => {
  const KEY = 'fixvault_cache';
  const FAV_KEY = 'fixvault_favorites';
  const HISTORY_KEY = 'fixvault_history';

  function save(solutions) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        data: solutions,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[FixVault] Cache save failed:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[FixVault] Cache load failed:', e);
      return null;
    }
  }

  function isStale(maxAgeMs = 1000 * 60 * 60) { // 1h par défaut
    const cached = load();
    if (!cached) return true;
    return (Date.now() - cached.timestamp) > maxAgeMs;
  }

  /* Favoris */
  function getFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function toggleFavorite(id) {
    const favs = getFavorites();
    const idx = favs.indexOf(id);
    if (idx === -1) favs.push(id);
    else favs.splice(idx, 1);
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    return idx === -1;
  }

  function isFavorite(id) {
    return getFavorites().includes(id);
  }

  /* Historique */
  function addHistory(id) {
    try {
      let hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      hist = hist.filter(h => h !== id);
      hist.unshift(id);
      if (hist.length > 50) hist = hist.slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch (e) {}
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (e) { return []; }
  }

  return { save, load, isStale, getFavorites, toggleFavorite, isFavorite, addHistory, getHistory };
})();
