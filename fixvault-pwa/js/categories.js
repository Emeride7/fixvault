/**
 * FixVault – categories.js
 * ─────────────────────────────────────────────
 * Gestion des catégories (mémoire + localStorage).
 * Aucune table Supabase supplémentaire requise.
 */

const CategoriesManager = (() => {
  const STORAGE_KEY = 'fixvault_categories';

  const DEFAULTS = [
    { label: 'Windows', icon: '⊞', color: '#4d94ff' },
    { label: 'Network', icon: '◎', color: '#00e5a0' },
    { label: 'Printers', icon: '⎙', color: '#f5c542' },
    { label: 'Security', icon: '⚿', color: '#ff4d6d' },
    { label: 'Scripts', icon: '⌥', color: '#b57bff' },
    { label: 'Linux', icon: '◉', color: '#ff8c42' },
    { label: 'Video Surveillance', icon: '◉', color: '#ff8c42' },
  ];

  let categories = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const custom = raw ? JSON.parse(raw) : [];
      // Merge defaults + custom (custom peut override)
      const map = new Map();
      DEFAULTS.forEach(c => map.set(c.label, { ...c }));
      custom.forEach(c => map.set(c.label, { ...c }));
      categories = Array.from(map.values());
    } catch (e) {
      categories = [...DEFAULTS];
    }
  }

  function persist() {
    // Ne persister que les catégories non-default ou modifiées
    const custom = categories.filter(c => {
      const def = DEFAULTS.find(d => d.label === c.label);
      return !def || def.color !== c.color || def.icon !== c.icon;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }

  function init() {
    load();
  }

  function getAll() {
    return [...categories];
  }

  function getColor(label) {
    const cat = categories.find(c => c.label === label);
    return cat ? cat.color : '#8891a8';
  }

  function getIcon(label) {
    const cat = categories.find(c => c.label === label);
    return cat ? cat.icon : '◈';
  }

  function getSidebarHtml() {
    return categories.map(cat => {
      const slug = cat.label.replace(/\s/g, '-').toLowerCase();
      return `
        <li class="category-item cat-${slug}" data-cat="${escapeHtml(cat.label)}">
          <span class="cat-icon">${escapeHtml(cat.icon)}</span>
          ${escapeHtml(cat.label)}
          <span id="count-${slug}" class="cat-count">0</span>
        </li>
      `;
    }).join('');
  }

  function getOptionsHtml() {
    return categories.map(cat =>
      `<option value="${escapeHtml(cat.label)}">${escapeHtml(cat.label)}</option>`
    ).join('');
  }

  function add(label, icon, color) {
    if (!label || categories.some(c => c.label.toLowerCase() === label.toLowerCase())) {
      throw new Error('Cette catégorie existe déjà.');
    }
    categories.push({ label, icon: icon || '◈', color: color || '#8891a8' });
    persist();
  }

  function update(oldLabel, updates) {
    const idx = categories.findIndex(c => c.label === oldLabel);
    if (idx === -1) throw new Error('Catégorie introuvable.');
    categories[idx] = { ...categories[idx], ...updates };
    persist();
  }

  function remove(label) {
    const idx = categories.findIndex(c => c.label === label);
    if (idx === -1) throw new Error('Catégorie introuvable.');
    categories.splice(idx, 1);
    persist();
  }

  function renderManageList(container, onEdit, onDelete) {
    if (!container) return;
    container.innerHTML = categories.map(cat => `
      <div class="category-manage-item">
        <div class="category-manage-info">
          <span class="category-icon" style="color:${cat.color}">${escapeHtml(cat.icon)}</span>
          <span class="category-label">${escapeHtml(cat.label)}</span>
          <span class="category-color" style="background:${cat.color}"></span>
        </div>
        <div class="category-manage-actions">
          <button onclick="CategoriesManager._triggerEdit('${escapeHtml(cat.label)}')">✎</button>
          <button onclick="CategoriesManager._triggerDelete('${escapeHtml(cat.label)}')">🗑</button>
        </div>
      </div>
    `).join('');

    // Stocker les callbacks pour les appels inline
    CategoriesManager._editCb = onEdit;
    CategoriesManager._deleteCb = onDelete;
  }

  function _triggerEdit(label) {
    if (CategoriesManager._editCb) CategoriesManager._editCb(label);
  }
  function _triggerDelete(label) {
    if (CategoriesManager._deleteCb) CategoriesManager._deleteCb(label);
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    init, load, getAll, getColor, getIcon,
    getSidebarHtml, getOptionsHtml,
    add, update, remove,
    renderManageList, _triggerEdit, _triggerDelete
  };
})();
