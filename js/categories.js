/**
 * FixVault – categories.js
 * Gestion dynamique des catégories
 */

const CategoriesManager = (() => {
  let categories = [];

  // Catégories par défaut
  const DEFAULT_CATEGORIES = [
    { label: 'Windows', icon: '⊞', color: '#4d94ff', sort_order: 1 },
    { label: 'Network', icon: '⋈', color: '#00e5a0', sort_order: 2 },
    { label: 'Printers', icon: '▤', color: '#f5c542', sort_order: 3 },
    { label: 'Security', icon: '⊕', color: '#ff4d6d', sort_order: 4 },
    { label: 'Scripts', icon: '≫', color: '#b57bff', sort_order: 5 },
    { label: 'Linux', icon: '◈', color: '#ff8c42', sort_order: 6 },
    { label: 'Video Surveillance', icon: '◈', color: '#ff8c42', sort_order: 7 }
  ];

  async function init() {
    await load();
    if (categories.length === 0) {
      await seedDefaultCategories();
    }
  }

  async function load() {
    const { data, error } = await window.supabaseClient
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[Categories] Erreur chargement :', error);
      categories = [];
      return [];
    }

    categories = data || [];
    return categories;
  }

  async function seedDefaultCategories() {
    console.log('[Categories] Insertion des catégories par défaut...');
    
    for (const cat of DEFAULT_CATEGORIES) {
      const { error } = await window.supabaseClient
        .from('categories')
        .insert([cat]);
      
      if (error) console.error('[Categories] Erreur insertion :', cat.label, error);
    }
    
    await load();
  }

  async function add(label, icon = '◈', color = '#8891a8') {
    if (!label || label.trim() === '') {
      throw new Error('Le nom de la catégorie est requis');
    }

    const sort_order = categories.length + 1;

    const { data, error } = await window.supabaseClient
      .from('categories')
      .insert([{ label: label.trim(), icon, color, sort_order }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Cette catégorie existe déjà');
      throw error;
    }

    categories.push(data);
    await load(); // Recharger pour garder l'ordre
    return data;
  }

  async function remove(label) {
    // Vérifier qu'aucune solution n'utilise cette catégorie
    const { count, error: countError } = await window.supabaseClient
      .from('solutions')
      .select('*', { count: 'exact', head: true })
      .eq('category', label);

    if (countError) throw countError;
    
    if (count > 0) {
      throw new Error(`Impossible : ${count} solution(s) utilisent cette catégorie. Reassignez-les d'abord.`);
    }

    const { error } = await window.supabaseClient
      .from('categories')
      .delete()
      .eq('label', label);

    if (error) throw error;
    
    categories = categories.filter(c => c.label !== label);
    await reorderCategories();
  }

  async function update(oldLabel, updates) {
    const { data, error } = await window.supabaseClient
      .from('categories')
      .update(updates)
      .eq('label', oldLabel)
      .select()
      .single();

    if (error) throw error;
    
    // Mettre à jour les solutions qui utilisent l'ancienne catégorie
    if (updates.label && updates.label !== oldLabel) {
      const { error: updateError } = await window.supabaseClient
        .from('solutions')
        .update({ category: updates.label })
        .eq('category', oldLabel);
      
      if (updateError) throw updateError;
    }
    
    const index = categories.findIndex(c => c.label === oldLabel);
    if (index !== -1) categories[index] = data;
    
    return data;
  }

  async function reorderCategories() {
    for (let i = 0; i < categories.length; i++) {
      const { error } = await window.supabaseClient
        .from('categories')
        .update({ sort_order: i + 1 })
        .eq('label', categories[i].label);
      
      if (error) console.error('[Categories] Erreur reorder :', error);
    }
    await load();
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

  function getOptionsHtml() {
    return categories.map(c => 
      `<option value="${escapeHtml(c.label)}">${escapeHtml(c.label)}</option>`
    ).join('');
  }

  function getSidebarHtml() {
    return categories.map(c => `
      <li class="category-item" data-cat="${escapeHtml(c.label)}">
        <span class="cat-icon">${c.icon}</span>
        <span>${escapeHtml(c.label)}</span>
        <span class="cat-count" id="count-${c.label.replace(/\s/g, '-').toLowerCase()}">0</span>
      </li>
    `).join('');
  }

  function renderManageList(container, onEdit, onDelete) {
    if (!container) return;
    
    container.innerHTML = categories.map(cat => `
      <div class="category-manage-item" data-label="${escapeHtml(cat.label)}">
        <div class="category-manage-info">
          <span class="category-icon" style="color:${cat.color}">${cat.icon}</span>
          <span class="category-label">${escapeHtml(cat.label)}</span>
          <span class="category-color" style="background:${cat.color}"></span>
        </div>
        <div class="category-manage-actions">
          <button class="btn-edit-category btn-sm" data-label="${escapeHtml(cat.label)}">✏️</button>
          <button class="btn-delete-category btn-sm" data-label="${escapeHtml(cat.label)}">🗑️</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-edit-category').forEach(btn => {
      btn.addEventListener('click', () => onEdit(btn.dataset.label));
    });
    
    container.querySelectorAll('.btn-delete-category').forEach(btn => {
      btn.addEventListener('click', () => onDelete(btn.dataset.label));
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { 
    init, load, add, remove, update, getAll, getColor, getIcon, 
    getOptionsHtml, getSidebarHtml, renderManageList 
  };
})();