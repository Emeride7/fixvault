/**
 * FixVault – app.js
 * Application principale
 */

const FixVaultApp = (() => {
  const TABLE = 'solutions';
  const PAGE_SIZE = 9;

  const state = {
    solutions: [],
    filtered: [],
    activeCategory: 'all',
    searchTerm: '',
    favOnly: false,
    currentPage: 1,
    loading: false,
  };

  function normalizeArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {}
      return trimmed.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [];
  }

  function normalizeSolution(row) {
    return {
      id: row.id,
      title: row.title || '',
      category: row.category || 'Sans catégorie',
      problem: row.problem || '',
      solution: row.solution || '',
      commands: normalizeArray(row.commands),
      tags: normalizeArray(row.tags),
      created_at: row.created_at || row.inserted_at || null,
      updated_at: row.updated_at || null,
    };
  }

  function setLoading(show) {
    state.loading = show;
    const loading = document.getElementById('loadingState');
    const grid = document.getElementById('solutionsGrid');
    const empty = document.getElementById('emptyState');
    const error = document.getElementById('errorState');
    if (loading) loading.classList.toggle('hidden', !show);
    if (show) {
      if (grid) grid.innerHTML = '';
      if (empty) empty.classList.add('hidden');
      if (error) error.classList.add('hidden');
    }
  }

  function showError(message) {
    const error = document.getElementById('errorState');
    const msg = document.getElementById('errorMessage');
    const empty = document.getElementById('emptyState');
    const grid = document.getElementById('solutionsGrid');
    if (msg) msg.textContent = message;
    if (error) error.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    if (grid) grid.innerHTML = '';
  }

  async function loadSolutions(forceRemote = false) {
    setLoading(true);
    try {
      const canUseRemote = !!window.supabaseClient;
      if (!canUseRemote && !forceRemote) {
        const cached = Cache.load();
        if (cached?.data?.length) {
          state.solutions = cached.data.map(normalizeSolution);
          renderAll();
          updateOfflineBadge(true);
          Toast.show('Mode hors-ligne : données chargées depuis le cache.', 'info');
          return;
        }
        throw new Error('Base de données indisponible.');
      }

      const { data, error } = await window.supabaseClient
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      state.solutions = (data || []).map(normalizeSolution);
      Cache.save(state.solutions);
      updateOfflineBadge(false);
      renderAll();
    } catch (error) {
      console.error('[FixVault] loadSolutions failed:', error);
      const cached = Cache.load();
      if (cached?.data?.length) {
        state.solutions = cached.data.map(normalizeSolution);
        renderAll();
        updateOfflineBadge(true);
        Toast.show('Connexion indisponible. Cache local utilisé.', 'info');
      } else {
        showError(`Impossible de charger les solutions${error?.message ? ` : ${error.message}` : '.'}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateOfflineBadge(isOffline) {
    const badge = document.getElementById('offlineBadge');
    if (badge) badge.classList.toggle('hidden', !isOffline);
  }

  function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    list.innerHTML = `
      <li class="category-item ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
        <span class="cat-icon">▦</span> Toutes
        <span id="count-all" class="cat-count">0</span>
      </li>
      ${CategoriesManager.getSidebarHtml()}
    `;

    list.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', () => {
        state.activeCategory = item.dataset.cat;
        state.currentPage = 1;
        renderCategories();
        applyFilters();
      });
    });

    updateCategoryCounts();
  }

  function updateCategoryCounts() {
    const allCount = document.getElementById('count-all');
    if (allCount) allCount.textContent = String(state.solutions.length);

    const counts = state.solutions.reduce((acc, sol) => {
      acc[sol.category] = (acc[sol.category] || 0) + 1;
      return acc;
    }, {});

    CategoriesManager.getAll().forEach(cat => {
      const slug = cat.label.replace(/\s/g, '-').toLowerCase();
      const el = document.getElementById(`count-${slug}`);
      if (el) el.textContent = String(counts[cat.label] || 0);
    });
  }

  function getCurrentCategoryLabel() {
    if (state.activeCategory === 'all') return 'Toutes les solutions';
    return state.activeCategory;
  }

  function truncate(text, len = 150) {
    const plain = (text || '').replace(/[#>*`_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain.length <= len) return plain;
    return plain.slice(0, len - 1) + '…';
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSolutionCard(sol) {
    const fav = Cache.isFavorite(sol.id);
    const color = CategoriesManager.getColor(sol.category);
    const icon = CategoriesManager.getIcon(sol.category);
    return `
      <article class="solution-card" data-id="${escapeHtml(sol.id)}">
        <div class="solution-card-top">
          <span class="solution-category" style="background:${color}22;color:${color};border:1px solid ${color}44">
            ${escapeHtml(icon)} ${escapeHtml(sol.category)}
          </span>
          <button class="card-fav-btn ${fav ? 'is-fav' : ''}" data-fav-id="${escapeHtml(sol.id)}" title="Favori">
            ${fav ? '★' : '☆'}
          </button>
        </div>
        <h3 class="solution-title">${escapeHtml(sol.title)}</h3>
        <p class="solution-problem">${escapeHtml(truncate(sol.problem, 140))}</p>
        <div class="solution-tags">
          ${(sol.tags || []).slice(0, 4).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="solution-meta-row">
          <span>${(sol.commands || []).length} commande${(sol.commands || []).length > 1 ? 's' : ''}</span>
          <span>${sol.created_at ? new Date(sol.created_at).toLocaleDateString('fr-FR') : '—'}</span>
        </div>
      </article>
    `;
  }

  function renderGrid() {
    const grid = document.getElementById('solutionsGrid');
    const empty = document.getElementById('emptyState');
    const error = document.getElementById('errorState');
    if (!grid) return;

    if (error) error.classList.add('hidden');

    if (!state.filtered.length) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      renderPagination();
      updateHeaderMeta();
      return;
    }

    if (empty) empty.classList.add('hidden');

    const start = (state.currentPage - 1) * PAGE_SIZE;
    const pageItems = state.filtered.slice(start, start + PAGE_SIZE);
    grid.innerHTML = pageItems.map(renderSolutionCard).join('');

    grid.querySelectorAll('.solution-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.card-fav-btn')) return;
        const id = card.dataset.id;
        const sol = state.solutions.find(s => String(s.id) === String(id));
        if (sol) Modal.openDetail(sol, handleOpenEdit, handleDeleteRequest);
      });
    });

    grid.querySelectorAll('.card-fav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Cache.toggleFavorite(btn.dataset.favId);
        updateFavCount();
        renderFilteredSolutions();
      });
    });

    renderPagination();
    updateHeaderMeta();
  }

  function updateHeaderMeta() {
    const title = document.getElementById('contentTitle');
    const meta = document.getElementById('contentMeta');
    if (title) title.textContent = getCurrentCategoryLabel() + (state.favOnly ? ' · Favoris' : '');
    if (meta) meta.textContent = `${state.filtered.length} solution${state.filtered.length > 1 ? 's' : ''}`;
  }

  function renderPagination() {
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    if (pagination) pagination.classList.toggle('hidden', state.filtered.length <= PAGE_SIZE);
    if (pageInfo) pageInfo.textContent = `Page ${state.currentPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
  }

  function updateSidebarStats() {
    const total = document.getElementById('statTotal');
    const filtered = document.getElementById('statFiltered');
    if (total) total.textContent = String(state.solutions.length);
    if (filtered) filtered.textContent = String(state.filtered.length);
    updateFavCount();
  }

  function updateFavCount() {
    const favEl = document.getElementById('statFav');
    const favCount = state.solutions.filter(sol => Cache.isFavorite(sol.id)).length;
    if (favEl) favEl.textContent = String(favCount);
  }

  function applyFilters() {
    let result = Search.filter(state.solutions, state.searchTerm, state.activeCategory);
    if (state.favOnly) result = result.filter(sol => Cache.isFavorite(sol.id));
    state.filtered = result;
    renderGrid();
    updateSidebarStats();
  }

  function renderAll() {
    renderCategories();
    applyFilters();
  }

  function renderFilteredSolutions() {
    applyFilters();
  }

  function findSolutionById(id) {
    return state.solutions.find(sol => String(sol.id) === String(id));
  }

  async function saveSolution(payload, editId = null) {
    if (!Auth.isAdmin()) {
      openLoginModal();
      return;
    }

    try {
      const submitBtn = document.getElementById('submitForm');
      if (submitBtn) submitBtn.disabled = true;

      const row = {
        title: payload.title,
        category: payload.category,
        problem: payload.problem,
        solution: payload.solution,
        commands: payload.commands,
        tags: payload.tags,
      };

      let error;
      if (editId) {
        ({ error } = await window.supabaseClient.from(TABLE).update(row).eq('id', editId));
      } else {
        ({ error } = await window.supabaseClient.from(TABLE).insert([row]));
      }
      if (error) throw error;

      Toast.show(editId ? 'Solution mise à jour ✓' : 'Solution ajoutée ✓', 'success');
      await loadSolutions(true);
    } catch (error) {
      console.error('[FixVault] saveSolution failed:', error);
      Toast.show(`Enregistrement impossible${error?.message ? ` : ${error.message}` : ''}`, 'error');
    } finally {
      const submitBtn = document.getElementById('submitForm');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function handleOpenEdit(sol) {
    if (!Auth.isAdmin()) {
      openLoginModal();
      return;
    }
    Modal.openEdit(sol, saveSolution);
  }

  async function handleDeleteRequest(id) {
    if (!Auth.isAdmin()) {
      openLoginModal();
      return;
    }
    try {
      const { error } = await window.supabaseClient.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      Toast.show('Solution supprimée.', 'info');
      await loadSolutions(true);
    } catch (error) {
      console.error('[FixVault] delete failed:', error);
      Toast.show(`Suppression impossible${error?.message ? ` : ${error.message}` : ''}`, 'error');
    }
  }

  function exportSolutions() {
    const payload = JSON.stringify(state.solutions, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixvault-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Toast.show('Export JSON téléchargé.', 'success');
  }

  async function importSolutions(file) {
    if (!Auth.isAdmin()) {
      openLoginModal();
      return;
    }
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Le fichier JSON doit contenir un tableau.');

      const rows = parsed.map(item => ({
        ...(item.id ? { id: item.id } : {}),
        title: item.title || '',
        category: item.category || 'Sans catégorie',
        problem: item.problem || '',
        solution: item.solution || '',
        commands: normalizeArray(item.commands),
        tags: normalizeArray(item.tags),
      }));

      const { error } = await window.supabaseClient.from(TABLE).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      Toast.show('Import terminé ✓', 'success');
      await loadSolutions(true);
    } catch (error) {
      console.error('[FixVault] import failed:', error);
      Toast.show(`Import impossible${error?.message ? ` : ${error.message}` : ''}`, 'error');
    }
  }

  function openLoginModal() {
    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');
    if (email) email.value = '';
    if (password) password.value = '';
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  async function handleLoginSubmit() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value || '';
    if (!email || !password) {
      Toast.show('Email et mot de passe requis.', 'error');
      return;
    }
    const ok = await Auth.login(email, password);
    if (ok) {
      const loginModal = document.getElementById('loginModal');
      if (loginModal) loginModal.classList.add('hidden');
      document.body.style.overflow = '';
      await loadSolutions(true);
    }
  }

  function setupSearch() {
    const input = document.getElementById('searchInput');
    const help = document.getElementById('searchHelp');
    if (!input) return;

    input.addEventListener('focus', () => {
      if (help) help.classList.remove('hidden');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (help) help.classList.add('hidden');
        Search.hideSuggestions();
      }, 180);
    });

    input.addEventListener('input', () => {
      state.searchTerm = input.value;
      state.currentPage = 1;
      renderFilteredSolutions();
      const suggestions = Search.getSuggestions(state.solutions, input.value);
      Search.renderSuggestions(suggestions, Search.parseQuery ? Search.parseQuery(input.value).free : input.value, id => {
        const sol = findSolutionById(id);
        if (sol) Modal.openDetail(sol, handleOpenEdit, handleDeleteRequest);
      });
    });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function setupPagination() {
    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage -= 1;
        renderGrid();
      }
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
      if (state.currentPage < totalPages) {
        state.currentPage += 1;
        renderGrid();
      }
    });
  }

  function setupCategoryManagement() {
    const manageBtn = document.getElementById('btnManageCategories');
    const addBtn = document.getElementById('btnAddCategory');
    const list = document.getElementById('categoriesList');

    function refreshManageList() {
      CategoriesManager.renderManageList(list, label => {
        const current = CategoriesManager.getAll().find(c => c.label === label);
        if (!current) return;
        const newLabel = window.prompt('Nom de la catégorie', current.label);
        if (!newLabel) return;
        const newIcon = window.prompt('Icône', current.icon || '◈');
        const newColor = window.prompt('Couleur hexadécimale', current.color || '#8891a8');
        CategoriesManager.update(label, {
          label: newLabel.trim(),
          icon: (newIcon || '◈').trim(),
          color: (newColor || '#8891a8').trim(),
        });
        renderCategories();
        refreshManageList();
        Toast.show('Catégorie mise à jour.', 'success');
      }, label => {
        Modal.openConfirm(() => {
          CategoriesManager.remove(label);
          renderCategories();
          refreshManageList();
          Toast.show('Catégorie supprimée.', 'info');
        });
      });
    }

    if (manageBtn) manageBtn.addEventListener('click', () => {
      refreshManageList();
      const modal = document.getElementById('categoriesModal');
      if (modal) modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });

    if (addBtn) addBtn.addEventListener('click', () => {
      const labelEl = document.getElementById('newCategoryLabel');
      const iconEl = document.getElementById('newCategoryIcon');
      const colorEl = document.getElementById('newCategoryColor');
      const label = labelEl?.value.trim();
      const icon = iconEl?.value.trim() || '◈';
      const color = colorEl?.value || '#8891a8';
      try {
        CategoriesManager.add(label, icon, color);
        if (labelEl) labelEl.value = '';
        if (iconEl) iconEl.value = '◈';
        if (colorEl) colorEl.value = '#00e5a0';
        renderCategories();
        refreshManageList();
        Toast.show('Catégorie ajoutée ✓', 'success');
      } catch (error) {
        Toast.show(error.message || 'Ajout impossible.', 'error');
      }
    });
  }

  function setupButtons() {
    document.getElementById('btnHowTo')?.addEventListener('click', () => Modal.openHowTo());
    document.getElementById('btnDashboard')?.addEventListener('click', () => Dashboard.open(state.solutions));
    document.getElementById('btnRefreshDash')?.addEventListener('click', () => Dashboard.open(state.solutions));
    document.getElementById('btnExportDash')?.addEventListener('click', exportSolutions);
    document.getElementById('btnExport')?.addEventListener('click', exportSolutions);
    document.getElementById('btnImport')?.addEventListener('click', () => document.getElementById('importFile')?.click());
    document.getElementById('importFile')?.addEventListener('change', e => importSolutions(e.target.files?.[0]));
    document.getElementById('btnToggleFavFilter')?.addEventListener('click', e => {
      state.favOnly = !state.favOnly;
      state.currentPage = 1;
      e.currentTarget.classList.toggle('btn-admin-active', state.favOnly);
      renderFilteredSolutions();
    });
    document.getElementById('btnAddSolution')?.addEventListener('click', () => {
      if (!Auth.isAdmin()) return openLoginModal();
      Modal.openAdd(saveSolution);
    });
    document.getElementById('btnAddFromEmpty')?.addEventListener('click', () => {
      if (!Auth.isAdmin()) return openLoginModal();
      Modal.openAdd(saveSolution);
    });
    document.getElementById('btnAuthToggle')?.addEventListener('click', async () => {
      if (Auth.isAdmin()) {
        await Auth.logout();
      } else {
        openLoginModal();
      }
    });
    document.getElementById('submitLogin')?.addEventListener('click', handleLoginSubmit);
    document.getElementById('cancelLogin')?.addEventListener('click', () => {
      document.getElementById('loginModal')?.classList.add('hidden');
      document.body.style.overflow = '';
    });
    document.getElementById('loginPassword')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLoginSubmit();
    });
  }

  function setupConnectivity() {
    window.addEventListener('online', () => {
      updateOfflineBadge(false);
      loadSolutions(true);
    });
    window.addEventListener('offline', () => {
      updateOfflineBadge(true);
      Toast.show('Connexion perdue. Le mode hors-ligne reste disponible.', 'info');
    });
  }

  async function init() {
    CategoriesManager.init();
    await Auth.init();
    setupButtons();
    setupSearch();
    setupPagination();
    setupCategoryManagement();
    setupConnectivity();
    await loadSolutions();
  }

  return {
    init,
    loadSolutions,
    renderFilteredSolutions,
    updateFavCount,
    getState: () => state,
  };
})();

window.initApp = () => FixVaultApp.init();
window.loadSolutions = (forceRemote) => FixVaultApp.loadSolutions(forceRemote);
window.renderFilteredSolutions = () => FixVaultApp.renderFilteredSolutions();
window.updateFavCount = () => FixVaultApp.updateFavCount();
