/**
 * FixVault – app.js
 * Logique principale
 */

/* ══════════════════════════════════════════════
   ÉTAT GLOBAL
══════════════════════════════════════════════ */
window.allSolutions    = [];
let currentCategory    = 'all';
let currentSearchTerm  = '';
let debounceTimer      = null;

/* ══════════════════════════════════════════════
   POINT D'ENTRÉE
══════════════════════════════════════════════ */
window.initApp = async function () {
  console.log('[FixVault] Initialisation de l\'application…');

  await Auth.init();
  await CategoriesManager.init();
  await loadSolutions();
  bindEvents();
  renderSidebar();
  updateCategorySelect();
  
  // Déclencher l'événement pour les raccourcis
  window.dispatchEvent(new Event('appReady'));
};

/* ══════════════════════════════════════════════
   CHARGEMENT DES DONNÉES
══════════════════════════════════════════════ */
async function loadSolutions() {
  showLoading(true);

  const { data, error } = await window.supabaseClient
    .from('solutions')
    .select('*')
    .order('created_at', { ascending: false });

  showLoading(false);

  if (error) {
    console.error('[FixVault] Erreur Supabase :', error);
    Toast.show('Erreur de connexion à la base de données.', 'error');
    return;
  }

  window.allSolutions = data || [];
  console.log(`[FixVault] ${window.allSolutions.length} solutions chargées.`);

  updateCategoryCounts();
  renderFilteredSolutions();
}

/* ══════════════════════════════════════════════
   RENDU SIDEBAR
══════════════════════════════════════════════ */
function renderSidebar() {
  const container = document.getElementById('categoryList');
  if (!container) return;
  
  const categoriesHtml = CategoriesManager.getSidebarHtml();
  container.innerHTML = `
    <li class="category-item active" data-cat="all">
      <span class="cat-icon">▦</span>
      <span>Toutes</span>
      <span class="cat-count" id="count-all">0</span>
    </li>
    ${categoriesHtml}
  `;
  
  updateCategoryCounts();
  rebindCategoryEvents();
}

function rebindCategoryEvents() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;

  categoryList.querySelectorAll('.category-item').forEach(item => {
    item.removeEventListener('click', handleCategoryClick);
    item.addEventListener('click', handleCategoryClick);
  });
}

function handleCategoryClick(e) {
  const item = e.target.closest('.category-item');
  if (!item) return;

  document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');
  
  const catValue = item.dataset.cat;
  currentCategory = catValue === 'all' ? 'all' : catValue;
  renderFilteredSolutions();
}

/* ══════════════════════════════════════════════
   RENDU
══════════════════════════════════════════════ */
function renderFilteredSolutions() {
  const results = Search.filter(window.allSolutions, currentSearchTerm, currentCategory);
  renderSolutions(results);

  document.getElementById('statTotal').textContent    = window.allSolutions.length;
  document.getElementById('statFiltered').textContent = results.length;

  const titleEl = document.getElementById('contentTitle');
  const metaEl  = document.getElementById('contentMeta');
  
  if (currentCategory === 'all') {
    titleEl.textContent = 'Toutes les solutions';
  } else {
    titleEl.textContent = currentCategory;
  }
  metaEl.textContent  = `${results.length} solution${results.length > 1 ? 's' : ''}`;
}

function renderSolutions(solutions) {
  const grid  = document.getElementById('solutionsGrid');
  const empty = document.getElementById('emptyState');

  if (!solutions.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  grid.innerHTML = solutions.map((sol, i) => buildCard(sol, i)).join('');

  grid.querySelectorAll('.solution-card').forEach(card => {
    card.addEventListener('click', () => {
      const sol = window.allSolutions.find(s => s.id === card.dataset.id);
      if (sol) openSolutionDetail(sol);
    });
  });
}

function buildCard(sol, index) {
  const catColor = CategoriesManager.getColor(sol.category);
  const date     = sol.created_at
    ? new Date(sol.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : '';

  const tags = (sol.tags || []).slice(0, 4).map(t => {
    const isMatch = currentSearchTerm && t.toLowerCase().includes(currentSearchTerm.toLowerCase());
    return `<span class="tag ${isMatch ? 'tag-highlight' : ''}">${escapeHtml(t)}</span>`;
  }).join('');

  const firstCmd = (sol.commands || []).find(Boolean);
  const cmdPreview = firstCmd
    ? `<div class="card-cmd-preview">> ${escapeHtml(firstCmd)}</div>`
    : '';

  return `
    <article
      class="solution-card"
      data-id="${sol.id}"
      style="--cat-color: ${catColor}; animation-delay: ${index * 30}ms"
      role="button"
      tabindex="0"
      aria-label="Voir la solution : ${escapeHtml(sol.title)}"
    >
      <div class="card-top">
        <span class="card-category">${escapeHtml(sol.category)}</span>
        <span class="card-date">${date}</span>
      </div>
      <h3 class="card-title">${escapeHtml(sol.title)}</h3>
      <p class="card-problem">${escapeHtml(sol.problem)}</p>
      ${cmdPreview}
      <div class="card-tags">${tags}</div>
    </article>
  `;
}

/* ══════════════════════════════════════════════
   COMPTEURS CATÉGORIES
══════════════════════════════════════════════ */
function updateCategoryCounts() {
  const total = window.allSolutions.length;
  const countAll = document.getElementById('count-all');
  if (countAll) countAll.textContent = total;

  const categories = CategoriesManager.getAll();
  categories.forEach(cat => {
    const count = window.allSolutions.filter(s => s.category === cat.label).length;
    const el = document.getElementById(`count-${cat.label.replace(/\s/g, '-').toLowerCase()}`);
    if (el) el.textContent = count;
  });
}

function updateCategorySelect() {
  const select = document.getElementById('fCategory');
  if (select) {
    select.innerHTML = '<option value="">— Choisir —</option>' + CategoriesManager.getOptionsHtml();
  }
}

/* ══════════════════════════════════════════════
   CRUD
══════════════════════════════════════════════ */
async function saveSolution(data, editId = null) {
  let result;

  if (editId) {
    result = await window.supabaseClient
      .from('solutions')
      .update(data)
      .eq('id', editId)
      .select()
      .single();
  } else {
    result = await window.supabaseClient
      .from('solutions')
      .insert([data])
      .select()
      .single();
  }

  const { data: saved, error } = result;

  if (error) {
    console.error('[FixVault] Erreur sauvegarde :', error);
    Toast.show('Erreur lors de la sauvegarde.', 'error');
    return;
  }

  if (editId) {
    const idx = window.allSolutions.findIndex(s => s.id === editId);
    if (idx !== -1) window.allSolutions[idx] = saved;
    Toast.show('Solution mise à jour ✓', 'success');
  } else {
    window.allSolutions.unshift(saved);
    Toast.show('Solution enregistrée ✓', 'success');
  }

  updateCategoryCounts();
  renderFilteredSolutions();
}

async function deleteSolution(id) {
  const confirmed = window.confirm('Supprimer cette solution ? Cette action est irréversible.');
  if (!confirmed) return;

  const { error } = await window.supabaseClient
    .from('solutions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[FixVault] Erreur suppression :', error);
    Toast.show('Erreur lors de la suppression.', 'error');
    return;
  }

  window.allSolutions = window.allSolutions.filter(s => s.id !== id);
  Modal.closeAll();
  Toast.show('Solution supprimée.', 'info');
  updateCategoryCounts();
  renderFilteredSolutions();
}

/* ══════════════════════════════════════════════
   MODALES
══════════════════════════════════════════════ */
function openSolutionDetail(sol) {
  Modal.openDetail(
    sol,
    (s)  => Modal.openEdit(s, saveSolution),
    (id) => deleteSolution(id)
  );
}

/* ══════════════════════════════════════════════
   GESTION CATÉGORIES (ADMIN)
══════════════════════════════════════════════ */
async function openCategoriesManager() {
  if (!Auth.isAdmin()) {
    Toast.show('Accès réservé aux administrateurs', 'error');
    return;
  }
  
  const modal = document.getElementById('categoriesModal');
  if (!modal) return;
  
  await CategoriesManager.load();
  
  const listContainer = document.getElementById('categoriesList');
  CategoriesManager.renderManageList(
    listContainer,
    (label) => editCategory(label),
    async (label) => {
      if (confirm(`Supprimer la catégorie "${label}" ?`)) {
        try {
          await CategoriesManager.remove(label);
          await loadSolutions();
          renderSidebar();
          updateCategorySelect();
          Toast.show(`Catégorie "${label}" supprimée`, 'success');
          openCategoriesManager(); // Rafraîchir la modal
        } catch (err) {
          Toast.show(err.message, 'error');
        }
      }
    }
  );
  
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

async function editCategory(label) {
  const cat = CategoriesManager.getAll().find(c => c.label === label);
  if (!cat) return;
  
  const newLabel = prompt('Nouveau nom :', cat.label);
  const newIcon = prompt('Nouvelle icône :', cat.icon);
  const newColor = prompt('Nouvelle couleur (hex) :', cat.color);
  
  if (newLabel || newIcon || newColor) {
    const updates = {};
    if (newLabel && newLabel !== cat.label) updates.label = newLabel;
    if (newIcon && newIcon !== cat.icon) updates.icon = newIcon;
    if (newColor && newColor !== cat.color) updates.color = newColor;
    
    if (Object.keys(updates).length > 0) {
      try {
        await CategoriesManager.update(label, updates);
        await loadSolutions();
        renderSidebar();
        updateCategorySelect();
        Toast.show('Catégorie mise à jour', 'success');
        openCategoriesManager();
      } catch (err) {
        Toast.show(err.message, 'error');
      }
    }
  }
}

async function addNewCategory() {
  const label = document.getElementById('newCategoryLabel').value.trim();
  const icon = document.getElementById('newCategoryIcon').value.trim() || '◈';
  const color = document.getElementById('newCategoryColor').value;
  
  if (!label) {
    Toast.show('Nom de catégorie requis', 'error');
    return;
  }
  
  try {
    await CategoriesManager.add(label, icon, color);
    await loadSolutions();
    renderSidebar();
    updateCategorySelect();
    
    document.getElementById('newCategoryLabel').value = '';
    document.getElementById('newCategoryIcon').value = '◈';
    document.getElementById('newCategoryColor').value = '#8891a8';
    
    Toast.show(`Catégorie "${label}" ajoutée`, 'success');
    openCategoriesManager(); // Rafraîchir
  } catch (err) {
    Toast.show(err.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   ÉVÉNEMENTS UI
══════════════════════════════════════════════ */
function bindEvents() {
  bindAuthEvents();
  bindSearchEvents();
  bindCategoryEvents();
  bindButtonEvents();
  bindAccessibilityEvents();
  bindDashboardEvents();
}

function bindAuthEvents() {
  const authBtn = document.getElementById('btnAuthToggle');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      if (Auth.isAdmin()) {
        Auth.logout();
        document.getElementById('adminCategoriesSection').style.display = 'none';
      } else {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('loginEmail').focus(), 100);
      }
    });
  }

  const submitLogin = document.getElementById('submitLogin');
  if (submitLogin) {
    submitLogin.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) {
        Toast.show('Email et mot de passe requis.', 'error');
        return;
      }
      const ok = await Auth.login(email, password);
      if (ok) {
        document.getElementById('loginModal').classList.add('hidden');
        document.body.style.overflow = '';
        document.getElementById('adminCategoriesSection').style.display = 'block';
      }
    });
  }

  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('submitLogin').click();
    });
  }

  const cancelLogin = document.getElementById('cancelLogin');
  if (cancelLogin) {
    cancelLogin.addEventListener('click', () => {
      document.getElementById('loginModal').classList.add('hidden');
      document.body.style.overflow = '';
    });
  }

  const closeLoginModal = document.getElementById('closeLoginModal');
  if (closeLoginModal) {
    closeLoginModal.addEventListener('click', () => {
      document.getElementById('loginModal').classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
  
  // Vérifier si admin au chargement
  if (Auth.isAdmin()) {
    document.getElementById('adminCategoriesSection').style.display = 'block';
  }
}

function bindSearchEvents() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchTerm = searchInput.value.trim();
      renderFilteredSolutions();

      const suggestions = Search.getSuggestions(window.allSolutions, currentSearchTerm);
      Search.renderSuggestions(suggestions, currentSearchTerm, (id) => {
        const sol = window.allSolutions.find(s => s.id === id);
        if (sol) {
          searchInput.value = sol.title;
          currentSearchTerm = sol.title;
          renderFilteredSolutions();
          openSolutionDetail(sol);
        }
      });
    }, 180);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) Search.hideSuggestions();
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

function bindCategoryEvents() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;
  
  categoryList.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', handleCategoryClick);
  });
}

function bindButtonEvents() {
  const addBtn = document.getElementById('btnAddSolution');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      Modal.openAdd(saveSolution);
    });
  }

  const addFromEmpty = document.getElementById('btnAddFromEmpty');
  if (addFromEmpty) {
    addFromEmpty.addEventListener('click', () => {
      Modal.openAdd(saveSolution);
    });
  }

  const howToBtn = document.getElementById('btnHowTo');
  if (howToBtn) {
    howToBtn.addEventListener('click', () => {
      Modal.openHowTo();
    });
  }
  
  const manageCategoriesBtn = document.getElementById('btnManageCategories');
  if (manageCategoriesBtn) {
    manageCategoriesBtn.addEventListener('click', openCategoriesManager);
  }
  
  const addCategoryBtn = document.getElementById('btnAddCategory');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', addNewCategory);
  }
  
  const closeCategoriesBtn = document.getElementById('closeCategoriesBtn');
  if (closeCategoriesBtn) {
    closeCategoriesBtn.addEventListener('click', () => {
      document.getElementById('categoriesModal').classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
  
  const closeCategoriesModal = document.getElementById('closeCategoriesModal');
  if (closeCategoriesModal) {
    closeCategoriesModal.addEventListener('click', () => {
      document.getElementById('categoriesModal').classList.add('hidden');
      document.body.style.overflow = '';
    });
  }
}

function bindDashboardEvents() {
  const dashboardBtn = document.getElementById('btnDashboard');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      if (window.allSolutions.length === 0) {
        Toast.show('Aucune solution à analyser', 'info');
        return;
      }
      Dashboard.open(window.allSolutions);
    });
  }
  
  const closeDashboardBtn = document.getElementById('closeDashboardModal');
  if (closeDashboardBtn) {
    closeDashboardBtn.addEventListener('click', () => Dashboard.close());
  }
}

function bindAccessibilityEvents() {
  const grid = document.getElementById('solutionsGrid');
  if (grid) {
    grid.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const card = e.target.closest('.solution-card');
        if (card) card.click();
      }
    });
  }
}

/* ══════════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════════ */
function showLoading(show) {
  const loadingEl = document.getElementById('loadingState');
  const gridEl = document.getElementById('solutionsGrid');
  if (loadingEl) loadingEl.classList.toggle('hidden', !show);
  if (gridEl) gridEl.classList.toggle('hidden', show);
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}