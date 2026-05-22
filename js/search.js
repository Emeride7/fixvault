/**
 * FixVault – search.js
 * ─────────────────────────────────────────────
 * Recherche instantanée côté client + suggestions.
 * Fonctionne sur le tableau en mémoire `window.allSolutions`.
 */

const Search = (() => {

  /**
   * Recherche dans une solution.
   * Retourne true si le terme est trouvé dans :
   * title, problem, solution, tags[], category
   */
  function matchesTerm(sol, term) {
    const t = term.toLowerCase().trim();
    if (!t) return true;
    return (
      sol.title?.toLowerCase().includes(t) ||
      sol.problem?.toLowerCase().includes(t) ||
      sol.solution?.toLowerCase().includes(t) ||
      sol.category?.toLowerCase().includes(t) ||
      (sol.tags || []).some(tag => tag.toLowerCase().includes(t)) ||
      (sol.commands || []).some(cmd => cmd.toLowerCase().includes(t))
    );
  }

  /**
   * Filtre le tableau de solutions par terme ET catégorie.
   * @param {Array}  solutions  - tableau complet
   * @param {string} term       - texte libre
   * @param {string} category   - catégorie sélectionnée ('all' = aucun filtre)
   * @returns {Array}
   */
  function filter(solutions, term, category) {
    return solutions.filter(sol => {
      const catOk  = category === 'all' || sol.category === category;
      const termOk = matchesTerm(sol, term);
      return catOk && termOk;
    });
  }

  /**
   * Génère des suggestions pour le dropdown de la barre de recherche.
   * Limite à 6 résultats pour ne pas surcharger l'UI.
   * @param {Array}  solutions
   * @param {string} term
   * @returns {Array}
   */
  function getSuggestions(solutions, term) {
    if (!term || term.length < 2) return [];
    const t = term.toLowerCase();
    return solutions
      .filter(sol => matchesTerm(sol, t))
      .slice(0, 6)
      .map(sol => ({
        id:       sol.id,
        title:    sol.title,
        category: sol.category,
        match:    getMatchSnippet(sol, t),
      }));
  }

  /**
   * Retourne un court extrait montrant où le terme a été trouvé.
   */
  function getMatchSnippet(sol, term) {
    if (sol.title?.toLowerCase().includes(term))    return 'titre';
    if (sol.problem?.toLowerCase().includes(term))  return 'problème';
    if (sol.solution?.toLowerCase().includes(term)) return 'solution';
    if ((sol.tags || []).some(t => t.toLowerCase().includes(term))) return 'tag';
    if ((sol.commands || []).some(c => c.toLowerCase().includes(term))) return 'commande';
    return '';
  }

  /**
   * Surligne un terme dans un texte (retourne du HTML sécurisé).
   */
  function highlight(text, term) {
    if (!term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(
      new RegExp(escapedTerm, 'gi'),
      match => `<mark class="suggestion-highlight">${match}</mark>`
    );
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Rendu du dropdown de suggestions ── */
  function renderSuggestions(suggestions, term, onSelect) {
    const el = document.getElementById('searchSuggestions');
    if (!suggestions.length) {
      el.classList.add('hidden');
      return;
    }

    el.innerHTML = suggestions.map(s => `
      <div class="suggestion-item" data-id="${s.id}">
        <span class="suggestion-cat" style="background:${getCatColor(s.category)}22;color:${getCatColor(s.category)};border:1px solid ${getCatColor(s.category)}44;">
          ${escapeHtml(s.category)}
        </span>
        <span class="suggestion-title">${highlight(s.title, term)}</span>
        ${s.match ? `<span class="suggestion-hint">dans ${s.match}</span>` : ''}
      </div>
    `).join('');

    el.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        onSelect(item.dataset.id);
        el.classList.add('hidden');
      });
    });

    el.classList.remove('hidden');
  }

  function hideSuggestions() {
    document.getElementById('searchSuggestions').classList.add('hidden');
  }

  /* ── Couleurs catégories ── */
  function getCatColor(cat) {
    const map = {
      Windows:  '#4d94ff',
      Network:  '#00e5a0',
      Printers: '#f5c542',
      Security: '#ff4d6d',
      Scripts:  '#b57bff',
      Linux:    '#ff8c42',
      Video Sureveillance:    '#ff8c42',
    };
    return map[cat] || '#8891a8';
  }

  return { filter, getSuggestions, renderSuggestions, hideSuggestions, getCatColor, highlight };
})();
