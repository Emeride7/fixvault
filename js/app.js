/**
 * FixVault – app.js
 * Logique principale
 */

/* ══════════════════════════════════════════════
 ÉTAT GLOBAL
══════════════════════════════════════════════ */
window.allSolutions = [];
let currentCategory = 'all';
let currentSearchTerm = '';
let debounceTimer = null;
let currentPage = 0;
const PAGE_SIZE = 20;
let showFavoritesOnly = false;
let deleteTargetId = null;

/* ══════════════════════════════════════════════
 POINT D'ENTRÉE
══════════════════════════════════════════════ */
window.initApp = async function () {
  console.log('[FixVault] Initialisation…');
  await Auth.init();
  CategoriesManager.init();
  await loadSolutions();
  bindEvents();
  renderSidebar();
  updateCategorySelect();
  updateFavCount();
  window.dispatchEvent(new Event('appReady'));
};

/* ══════════════════════════════════════════════
 CHARGEMENT DES DONNÉES
══════════════════════════════════════════════ */
async function loadSolutions() {
  showLoading(true);
  hideError();

  try {
    const { data, error } = await window.supabaseClient
      .from('solutions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    window.allSolutions = data || [];
    Cache.save(window.allSolutions);
  } catch (err) {
    console.error('[FixVault] Erreur Supabase :', err);
    const cached = Cache.load();
    if (cached && cached.data) {
      window.allSolutions = cached.data;
      Toast.show('Mode hors-ligne : données en cache', 'info');
      const badge = document.getElementById('offlineBadge');
      if (badge) badge.classList.remove('hidden');
    } else {
      showError('Impossible de contacter la base de données. Vérifiez votre connexion et la configuration Supabase.');
      showLoading(false);
      return;
    }
  }

  showLoading(false);
  console.log(`[FixVault] ${window.allSolutions.length} solutions chargées.`);
  updateCategoryCounts();
  renderFilteredSolutions();
}

window.loadSolutions = loadSolutions;

function showLoading(show) {
  const loadingEl = document.getElementById('loadingState');
  const gridEl = document.getElementById('solutionsGrid');
  if (loadingEl) loadingEl.classList.toggle('hidden', !show);
  if (gridEl) gridEl.classList.toggle('hidden', show);
}

function showError(msg) {
  const el = document.getElementById('errorState');
  const txt = document.getElementById('errorMessage');
  if (txt) txt.textContent = msg;
  if (el) el.classList.remove('hidden');
}

function hideError() {
  const el = document.getElementById('errorState');
  if (el) el.classList.add('hidden');
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
      <span class="cat-icon">▦</span> Toutes
      <span id="count-all" class="cat-count">0</span>
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
  currentPage = 0;
  renderFilteredSolutions();
}

/* ══════════════════════════════════════════════
 RENDU PRINCIPAL + PAGINATION
══════════════════════════════════════════════ */
function renderFilteredSolutions() {
  let results = Search.filter(window.allSolutions, currentSearchTerm, currentCategory);

  if (showFavoritesOnly) {
    const favs = Cache.getFavorites();
    results = results.filter(r => favs.includes(r.id));
  }

  const total = results.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);

  const paged = results.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  renderSolutions(paged);
  renderPagination(total, totalPages);

  document.getElementById('statTotal').textContent = window.allSolutions.length;
  document.getElementById('statFiltered').textContent = total;

  const titleEl = document.getElementById('contentTitle');
  const metaEl = document.getElementById('contentMeta');

  if (currentCategory === 'all') titleEl.textContent = showFavoritesOnly ? 'Solutions favorites' : 'Toutes les solutions';
  else titleEl.textContent = currentCategory;

  metaEl.textContent = `${total} solution${total > 1 ? 's' : ''} · Page ${currentPage + 1}/${totalPages}`;
}

function renderPagination(total, totalPages) {
  const pag = document.getElementById('pagination');
  if (total <= PAGE_SIZE) {
    pag.classList.add('hidden');
    return;
  }
  pag.classList.remove('hidden');
  document.getElementById('pageInfo').textContent = `Page ${currentPage + 1} / ${totalPages}`;
  document.getElementById('btnPrevPage').disabled = currentPage === 0;
  document.getElementById('btnNextPage').disabled = currentPage >= totalPages - 1;
}

function renderSolutions(solutions) {
  const grid = document.getElementById('solutionsGrid');
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
  const date = sol.created_at
    ? new Date(sol.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : '';
  const isFav = Cache.isFavorite(sol.id);

  const tags = (sol.tags || []).slice(0, 4).map(t => {
    const isMatch = currentSearchTerm && t.toLowerCase().includes(currentSearchTerm.toLowerCase());
    return `<span class="tag ${isMatch ? 'tag-highlight' : ''}">${escapeHtml(t)}</span>`;
  }).join('');

  const firstCmd = (sol.commands || []).find(Boolean);
  const cmdPreview = firstCmd ? `<div class="card-cmd-preview">&gt; ${escapeHtml(firstCmd)}</div>` : '';

  return `
    <article class="solution-card cat-${escapeHtml(sol.category.replace(/\s/g, '-').toLowerCase())}" data-id="${escapeHtml(sol.id)}" style="--cat-color:${catColor};animation-delay:${index * 0.03}s">
      <div class="card-top">
        <span class="card-category">${escapeHtml(sol.category)}</span>
        <span class="card-date">${date}</span>
      </div>
      <h3 class="card-title">
        ${isFav ? '<span class="card-fav">★</span>' : ''}
        ${escapeHtml(sol.title)}
      </h3>
      <p class="card-problem">${escapeHtml(sol.problem)}</p>
      ${cmdPreview}
      <div class="card-tags">${tags}</div>
    </article>
  `;
}

/* ══════════════════════════════════════════════
 COMPTEURS & FAVORIS
══════════════════════════════════════════════ */
function updateCategoryCounts() {
  const total = window.allSolutions.length;
  const countAll = document.getElementById('count-all');
  if (countAll) countAll.textContent = total;

  CategoriesManager.getAll().forEach(cat => {
    const count = window.allSolutions.filter(s => s.category === cat.label).length;
    const slug = cat.label.replace(/\s/g, '-').toLowerCase();
    const el = document.getElementById(`count-${slug}`);
    if (el) el.textContent = count;
  });
}

function updateCategorySelect() {
  const select = document.getElementById('fCategory');
  if (select) {
    select.innerHTML = '<option value="">— Choisir —</option>' + CategoriesManager.getOptionsHtml();
  }
}

function updateFavCount() {
  const el = document.getElementById('statFav');
  if (el) el.textContent = Cache.getFavorites().length;
}

/* ══════════════════════════════════════════════
 CRUD
══════════════════════════════════════════════ */
async function saveSolution(data, editId = null) {
  let result;
  try {
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
  } catch (err) {
    Toast.show('Erreur réseau lors de la sauvegarde.', 'error');
    return;
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

  Cache.save(window.allSolutions);
  updateCategoryCounts();
  renderFilteredSolutions();
}

async function deleteSolution(id) {
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
  Cache.save(window.allSolutions);
  updateCategoryCounts();
  renderFilteredSolutions();
}

/* ══════════════════════════════════════════════
 MODALES & NAVIGATION
══════════════════════════════════════════════ */
function openSolutionDetail(sol) {
  Modal.openDetail(
    sol,
    (s) => Modal.openEdit(s, saveSolution),
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

  const listContainer = document.getElementById('categoriesList');
  CategoriesManager.renderManageList(
    listContainer,
    (label) => editCategory(label),
    async (label) => {
      if (confirm(`Supprimer la catégorie "${label}" ?`)) {
        try {
          await CategoriesManager.remove(label);
          renderSidebar();
          updateCategorySelect();
          Toast.show(`Catégorie "${label}" supprimée`, 'success');
          openCategoriesManager();
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
    renderSidebar();
    updateCategorySelect();
    document.getElementById('newCategoryLabel').value = '';
    Toast.show(`Catégorie "${label}" ajoutée`, 'success');
    openCategoriesManager();
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
  bindPaginationEvents();
  bindThemeEvents();
  bindImportExportEvents();
}

function bindAuthEvents() {
  const authBtn = document.getElementById('btnAuthToggle');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      if (Auth.isAdmin()) {
        Auth.logout();
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
}

function bindSearchEvents() {
  const searchInput = document.getElementById('searchInput');
  const searchHelp = document.getElementById('searchHelp');
  if (!searchInput) return;

  searchInput.addEventListener('focus', () => {
    if (searchHelp) searchHelp.classList.remove('hidden');
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => { if (searchHelp) searchHelp.classList.add('hidden'); }, 200);
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchTerm = searchInput.value.trim();
      currentPage = 0;
      renderFilteredSolutions();

      const suggestions = Search.getSuggestions(window.allSolutions, currentSearchTerm);
      Search.renderSuggestions(suggestions, currentSearchTerm, (id) => {
        const sol = window.allSolutions.find(s => s.id === id);
        if (sol) {
          searchInput.value = sol.title;
          currentSearchTerm = sol.title;
          currentPage = 0;
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
  if (addBtn) addBtn.addEventListener('click', () => Modal.openAdd(saveSolution));

  const addFromEmpty = document.getElementById('btnAddFromEmpty');
  if (addFromEmpty) addFromEmpty.addEventListener('click', () => Modal.openAdd(saveSolution));

  const howToBtn = document.getElementById('btnHowTo');
  if (howToBtn) howToBtn.addEventListener('click', () => Modal.openHowTo());

  const manageCategoriesBtn = document.getElementById('btnManageCategories');
  if (manageCategoriesBtn) manageCategoriesBtn.addEventListener('click', openCategoriesManager);

  const addCategoryBtn = document.getElementById('btnAddCategory');
  if (addCategoryBtn) addCategoryBtn.addEventListener('click', addNewCategory);

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

  const favFilterBtn = document.getElementById('btnToggleFavFilter');
  if (favFilterBtn) {
    favFilterBtn.addEventListener('click', () => {
      showFavoritesOnly = !showFavoritesOnly;
      favFilterBtn.classList.toggle('btn-admin-active', showFavoritesOnly);
      currentPage = 0;
      renderFilteredSolutions();
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
  if (closeDashboardBtn) closeDashboardBtn.addEventListener('click', () => Dashboard.close());

  const exportDash = document.getElementById('btnExportDash');
  if (exportDash) exportDash.addEventListener('click', () => Dashboard.exportJSON(window.allSolutions));

  const refreshDash = document.getElementById('btnRefreshDash');
  if (refreshDash) refreshDash.addEventListener('click', () => Dashboard.open(window.allSolutions));
}

function bindPaginationEvents() {
  const prev = document.getElementById('btnPrevPage');
  const next = document.getElementById('btnNextPage');
  if (prev) prev.addEventListener('click', () => { if (currentPage > 0) { currentPage--; renderFilteredSolutions(); }});
  if (next) next.addEventListener('click', () => { currentPage++; renderFilteredSolutions(); });
}

function bindThemeEvents() {
  const btn = document.getElementById('btnTheme');
  if (!btn) return;

  const saved = localStorage.getItem('fixvault_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  btn.textContent = saved === 'light' ? '☾' : '☀';

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fixvault_theme', next);
    btn.textContent = next === 'light' ? '☾' : '☀';
  });
}

function bindImportExportEvents() {
  const btnExport = document.getElementById('btnExport');
  if (btnExport) btnExport.addEventListener('click', () => Dashboard.exportJSON(window.allSolutions));

  const btnImport = document.getElementById('btnImport');
  const fileInput = document.getElementById('importFile');
  if (btnImport && fileInput) {
    btnImport.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        Dashboard.importJSON(e.target.files[0], (data) => {
          let imported = 0;
          data.forEach(async (item) => {
            const { id, created_at, ...rest } = item;
            await saveSolution(rest);
            imported++;
          });
          Toast.show(`${imported} solutions importées`, 'success');
        });
        fileInput.value = '';
      }
    });
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
function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Seed demo data */
window.seedDemoData = async function() {
  const demos = [
    { title: "Réinitialiser TCP/IP", category: "Network", problem: "Pas de connexion Internet", solution: "1. Ouvrir CMD en admin\n2. Exécuter les commandes ci-dessous", commands: ["netsh int ip reset", "netsh winsock reset"], tags: ["tcpip", "reset"] },
    { title: "Spooler bloqué", category: "Printers", problem: "File d'impression bloquée", solution: "Arrêter le spooler et vider le dossier", commands: ["net stop spooler", "del /Q C:\\Windows\\System32\\spool\\PRINTERS\\*", "net start spooler"], tags: ["spooler", "impression"] },
    { title: "Mot de passe oublié Linux", category: "Linux", problem: "Accès root perdu", solution: "Démarrer en recovery mode et monter le FS", commands: ["mount -o remount,rw /", "passwd root"], tags: ["root", "password"] },
    { title: "RDP non fonctionnel", category: "Windows", problem: "Connexion bureau à distance impossible", solution: "Vérifier les services et le pare-feu", commands: ["sc query TermService", "netsh advfirewall set allprofiles state off"], tags: ["rdp", "remote"] },
    { title: "Fail2ban status", category: "Security", problem: "Vérifier les IPs bannies", solution: "Utiliser fail2ban-client", commands: ["fail2ban-client status", "fail2ban-client status sshd"], tags: ["fail2ban", "ssh"] },
    { title: "Script backup NAS", category: "Scripts", problem: "Sauvegarde automatique", solution: "Script rsync quotidien", commands: ["rsync -avz /data user@nas:/backup"], tags: ["backup", "rsync"] },
    { title: "Caméra Hikvision reset", category: "Video Surveillance", problem: "Mot de passe caméra oublié", solution: "Utiliser SADP tool ou reset physique", commands: [], tags: ["hikvision", "reset"] },
  ];

  for (const d of demos) {
    await saveSolution(d);
  }
  Toast.show('Données de démonstration ajoutées ✓', 'success');
};
