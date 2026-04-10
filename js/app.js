/**
 * FixVault – app.js
 * ─────────────────────────────────────────────
 * Logique principale :
 *  - Chargement des solutions depuis Supabase
 *  - Rendu des cartes
 *  - Filtres par catégorie
 *  - Connexion entre Search, Modal et Supabase
 *  - CRUD complet (Create, Read, Update, Delete)
 */

/* ══════════════════════════════════════════════
   ÉTAT GLOBAL
══════════════════════════════════════════════ */
window.allSolutions    = [];   // toutes les solutions en mémoire
let currentCategory    = 'all';
let currentSearchTerm  = '';
let debounceTimer      = null;

/* ══════════════════════════════════════════════
   POINT D'ENTRÉE (appelé par supabaseClient.js)
══════════════════════════════════════════════ */
window.initApp = async function () {
  console.log('[FixVault] Initialisation de l\'application…');

  // Charger les données
  await loadSolutions();

  // Brancher les événements UI
  bindEvents();
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
   RENDU
══════════════════════════════════════════════ */

/** Filtre et affiche les solutions selon l'état courant */
function renderFilteredSolutions() {
  const results = Search.filter(window.allSolutions, currentSearchTerm, currentCategory);
  renderSolutions(results);

  // Mettre à jour les stats
  document.getElementById('statTotal').textContent    = window.allSolutions.length;
  document.getElementById('statFiltered').textContent = results.length;

  // Titre de la zone principale
  const titleEl = document.getElementById('contentTitle');
  const metaEl  = document.getElementById('contentMeta');
  titleEl.textContent = currentCategory === 'all' ? 'Toutes les solutions' : currentCategory;
  metaEl.textContent  = `${results.length} solution${results.length > 1 ? 's' : ''}`;
}

/** Rend les cartes dans la grille */
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

  // Événements sur les cartes
  grid.querySelectorAll('.solution-card').forEach(card => {
    card.addEventListener('click', () => {
      const sol = window.allSolutions.find(s => s.id === card.dataset.id);
      if (sol) openSolutionDetail(sol);
    });
  });
}

/** Construit le HTML d'une carte */
function buildCard(sol, index) {
  const catClass = `cat-${sol.category?.toLowerCase() || 'default'}`;
  const catColor = Search.getCatColor(sol.category);
  const date     = sol.created_at
    ? new Date(sol.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : '';

  const tags = (sol.tags || []).slice(0, 4).map(t => {
    const isMatch = currentSearchTerm && t.toLowerCase().includes(currentSearchTerm.toLowerCase());
    return `<span class="tag ${isMatch ? 'tag-highlight' : ''}">${escHtml(t)}</span>`;
  }).join('');

  const firstCmd = (sol.commands || []).find(Boolean);
  const cmdPreview = firstCmd
    ? `<div class="card-cmd-preview">> ${escHtml(firstCmd)}</div>`
    : '';

  return `
    <article
      class="solution-card ${catClass}"
      data-id="${sol.id}"
      style="--cat-color: ${catColor}; animation-delay: ${index * 30}ms"
      role="button"
      tabindex="0"
      aria-label="Voir la solution : ${escHtml(sol.title)}"
    >
      <div class="card-top">
        <span class="card-category">${escHtml(sol.category)}</span>
        <span class="card-date">${date}</span>
      </div>
      <h3 class="card-title">${escHtml(sol.title)}</h3>
      <p class="card-problem">${escHtml(sol.problem)}</p>
      ${cmdPreview}
      <div class="card-tags">${tags}</div>
    </article>
  `;
}

/* ══════════════════════════════════════════════
   COMPTEURS CATÉGORIES
══════════════════════════════════════════════ */
function updateCategoryCounts() {
  const categories = ['Windows', 'Network', 'Printers', 'Security', 'Scripts', 'Linux'];
  const total = window.allSolutions.length;

  document.getElementById('count-all').textContent = total;

  categories.forEach(cat => {
    const count = window.allSolutions.filter(s => s.category === cat).length;
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = count;
  });
}

/* ══════════════════════════════════════════════
   CRUD – OPÉRATIONS SUPABASE
══════════════════════════════════════════════ */

/** Ajoute ou met à jour une solution */
async function saveSolution(data, editId = null) {
  let result;

  if (editId) {
    // Mise à jour
    result = await window.supabaseClient
      .from('solutions')
      .update(data)
      .eq('id', editId)
      .select()
      .single();
  } else {
    // Insertion
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

  // Mettre à jour le tableau local sans rechargement complet
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

/** Supprime une solution */
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
   OUVERTURE DES MODALES
══════════════════════════════════════════════ */

function openSolutionDetail(sol) {
  Modal.openDetail(
    sol,
    (s)  => Modal.openEdit(s, saveSolution),
    (id) => deleteSolution(id)
  );
}

/* ══════════════════════════════════════════════
   ÉVÉNEMENTS UI
══════════════════════════════════════════════ */
function bindEvents() {

  /* ── Barre de recherche ── */
  const searchInput = document.getElementById('searchInput');

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearchTerm = searchInput.value.trim();
      renderFilteredSolutions();

      // Suggestions
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

  // Masquer les suggestions en cliquant ailleurs
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) Search.hideSuggestions();
  });

  // Raccourci Ctrl+K / Cmd+K pour focus recherche
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  /* ── Filtres catégories ── */
  document.getElementById('categoryList').addEventListener('click', e => {
    const item = e.target.closest('.category-item');
    if (!item) return;

    document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    currentCategory = item.dataset.cat;
    renderFilteredSolutions();
  });

  /* ── Bouton Ajouter solution ── */
  document.getElementById('btnAddSolution').addEventListener('click', () => {
    Modal.openAdd(saveSolution);
  });

  // Depuis l'état vide
  document.getElementById('btnAddFromEmpty').addEventListener('click', () => {
    Modal.openAdd(saveSolution);
  });

  /* ── Bouton Comment ça marche ── */
  document.getElementById('btnHowTo').addEventListener('click', () => {
    Modal.openHowTo();
  });

  /* ── Accessibilité : Enter sur les cartes ── */
  document.getElementById('solutionsGrid').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const card = e.target.closest('.solution-card');
      if (card) card.click();
    }
  });
}

/* ══════════════════════════════════════════════
   ÉTAT CHARGEMENT
══════════════════════════════════════════════ */
function showLoading(show) {
  document.getElementById('loadingState').classList.toggle('hidden', !show);
  document.getElementById('solutionsGrid').classList.toggle('hidden', show);
}

/* ══════════════════════════════════════════════
   UTILITAIRE HTML
══════════════════════════════════════════════ */
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════════════════════
   DONNÉES DE DÉMONSTRATION
   (insérées automatiquement si la table est vide)
══════════════════════════════════════════════ */
window.seedDemoData = async function () {
  const demos = [
    {
      title: 'Vider le cache DNS Windows',
      category: 'Network',
      problem: 'Le DNS ne se résout pas correctement, certains sites ne s\'ouvrent pas ou pointent vers de vieilles adresses IP.',
      solution: 'Vider le cache DNS local de Windows force une résolution DNS fraîche. Ouvrir une invite de commande en administrateur et exécuter les commandes suivantes.',
      commands: ['ipconfig /flushdns', 'ipconfig /registerdns', 'netsh winsock reset'],
      tags: ['dns', 'réseau', 'flush', 'windows', 'cache'],
    },
    {
      title: 'Réinitialiser le spouleur d\'impression',
      category: 'Printers',
      problem: 'L\'imprimante n\'imprime plus, la file d\'attente est bloquée et les travaux restent en statut "Suppression en cours".',
      solution: 'Arrêter le service Spouleur, vider le répertoire des travaux en attente, puis redémarrer le service.',
      commands: ['net stop spooler', 'del /Q /F /S "%systemroot%\\System32\\spool\\PRINTERS\\*.*"', 'net start spooler'],
      tags: ['spouleur', 'impression', 'file d\'attente', 'windows', 'printer'],
    },
    {
      title: 'Forcer la mise à jour des stratégies de groupe',
      category: 'Windows',
      problem: 'Les GPO ne s\'appliquent pas sur le poste. L\'utilisateur n\'a pas les droits ou les logiciels attendus.',
      solution: 'Forcer une mise à jour des stratégies de groupe pour appliquer immédiatement les nouvelles GPO sans redémarrer.',
      commands: ['gpupdate /force', 'gpresult /r'],
      tags: ['gpo', 'group policy', 'active directory', 'windows', 'admin'],
    },
    {
      title: 'Analyser les ports ouverts avec netstat',
      category: 'Security',
      problem: 'Identifier les connexions réseau actives et les ports ouverts pour détecter une activité suspecte.',
      solution: 'Utiliser netstat pour lister toutes les connexions TCP/UDP actives avec le PID des processus associés.',
      commands: ['netstat -ano', 'netstat -b -n', 'tasklist /fi "pid eq [PID]"'],
      tags: ['sécurité', 'ports', 'netstat', 'connexions', 'audit'],
    },
    {
      title: 'Vérifier et réparer les fichiers système Windows',
      category: 'Windows',
      problem: 'Windows se comporte de manière instable, des erreurs système apparaissent, certains programmes ne se lancent pas.',
      solution: 'Lancer SFC (System File Checker) pour scanner et réparer automatiquement les fichiers système corrompus. Si SFC échoue, utiliser DISM.',
      commands: ['sfc /scannow', 'DISM /Online /Cleanup-Image /RestoreHealth', 'sfc /scannow'],
      tags: ['sfc', 'dism', 'réparation', 'fichiers système', 'windows'],
    },
    {
      title: 'Script Bash – Sauvegarde automatique',
      category: 'Scripts',
      problem: 'Besoin d\'automatiser la sauvegarde quotidienne d\'un répertoire vers un serveur NFS/SSH sans intervention manuelle.',
      solution: 'Script bash utilisant rsync pour une synchronisation incrémentale. À planifier via cron. Crée un log daté à chaque exécution.',
      commands: [
        'rsync -avz --delete /source/ user@server:/backup/',
        'chmod +x backup.sh',
        'crontab -e  # Ajouter: 0 2 * * * /opt/scripts/backup.sh',
      ],
      tags: ['bash', 'rsync', 'backup', 'cron', 'linux', 'automatisation'],
    },
    {
      title: 'Libérer de l\'espace disque sous Linux',
      category: 'Linux',
      problem: 'Le disque est plein, le système ralentit ou des services s\'arrêtent faute d\'espace disque disponible.',
      solution: 'Identifier les répertoires les plus volumineux, purger les anciens kernels, nettoyer le cache APT et les journaux systemd.',
      commands: [
        'df -h',
        'du -sh /* 2>/dev/null | sort -rh | head -20',
        'apt autoremove && apt clean',
        'journalctl --vacuum-time=7d',
      ],
      tags: ['linux', 'disque', 'espace', 'nettoyage', 'apt', 'journalctl'],
    },
  ];

  const { error } = await window.supabaseClient.from('solutions').insert(demos);
  if (error) {
    console.error('[FixVault] Erreur seed :', error);
    Toast.show('Erreur lors de l\'insertion des données de démo.', 'error');
  } else {
    Toast.show('Données de démonstration insérées ✓', 'success');
    await loadSolutions();
  }
};
