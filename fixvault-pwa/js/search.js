/**
 * FixVault – search.js
 * ─────────────────────────────────────────────
 * Recherche instantanée côté client + suggestions + syntaxe avancée.
 */

const Search = (() => {

  function parseQuery(raw) {
    const term = raw.toLowerCase().trim();
    const filters = { cat: null, tag: null, cmd: null, title: null, problem: null, free: '' };
    const regex = /\b(cat|tag|cmd|title|problem):([^\s]+)/gi;
    let m;
    while ((m = regex.exec(term)) !== null) {
      filters[m[1].toLowerCase()] = m[2].toLowerCase();
    }
    filters.free = term.replace(regex, '').trim();
    return filters;
  }

  function matchesTerm(sol, filters) {
    if (filters.cat && sol.category?.toLowerCase() !== filters.cat) return false;
    if (filters.tag && !(sol.tags || []).some(t => t.toLowerCase().includes(filters.tag))) return false;
    if (filters.cmd && !(sol.commands || []).some(c => c.toLowerCase().includes(filters.cmd))) return false;
    if (filters.title && !sol.title?.toLowerCase().includes(filters.title)) return false;
    if (filters.problem && !sol.problem?.toLowerCase().includes(filters.problem)) return false;

    const t = filters.free;
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

  function filter(solutions, rawTerm, category) {
    const filters = parseQuery(rawTerm);
    return solutions.filter(sol => {
      const catOk = category === 'all' || sol.category === category;
      return catOk && matchesTerm(sol, filters);
    });
  }

  function getSuggestions(solutions, rawTerm) {
    if (!rawTerm || rawTerm.length < 2) return [];
    const filters = parseQuery(rawTerm);
    const t = filters.free;
    return solutions
      .filter(sol => matchesTerm(sol, filters))
      .slice(0, 6)
      .map(sol => ({
        id: sol.id,
        title: sol.title,
        category: sol.category,
        match: getMatchSnippet(sol, t),
      }));
  }

  function getMatchSnippet(sol, term) {
    if (!term) return '';
    if (sol.title?.toLowerCase().includes(term)) return 'titre';
    if (sol.problem?.toLowerCase().includes(term)) return 'problème';
    if (sol.solution?.toLowerCase().includes(term)) return 'solution';
    if ((sol.tags || []).some(t => t.toLowerCase().includes(term))) return 'tag';
    if ((sol.commands || []).some(c => c.toLowerCase().includes(term))) return 'commande';
    return '';
  }

  function highlight(text, term) {
    if (!term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(
      new RegExp(escapedTerm, 'gi'),
      match => `<span class="suggestion-highlight">${match}</span>`
    );
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderSuggestions(suggestions, term, onSelect) {
    const el = document.getElementById('searchSuggestions');
    if (!el) return;
    if (!suggestions.length) {
      el.classList.add('hidden');
      return;
    }
    el.innerHTML = suggestions.map(s => `
      <div class="suggestion-item" data-id="${escapeHtml(s.id)}">
        <span class="suggestion-cat" style="background:${Search.getCatColor(s.category)}22;color:${Search.getCatColor(s.category)};border:1px solid ${Search.getCatColor(s.category)}44">${escapeHtml(s.category)}</span>
        <span class="suggestion-title">${highlight(s.title, term)}</span>
        <span class="suggestion-hint">${s.match ? `dans ${s.match}` : ''}</span>
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
    const el = document.getElementById('searchSuggestions');
    if (el) el.classList.add('hidden');
  }

  function getCatColor(cat) {
    return CategoriesManager.getColor(cat) || '#8891a8';
  }

  return { filter, getSuggestions, renderSuggestions, hideSuggestions, getCatColor, highlight, escapeHtml };
})();
