/**
 * FixVault – modal.js
 * ─────────────────────────────────────────────
 * Gestion de toutes les modales :
 *  - Détail d'une solution
 *  - Formulaire d'ajout / modification
 *  - Modal "Comment ça marche ?"
 */

const Modal = (() => {

  /* ═══════════════════════════════════════════
     UTILITAIRES
  ══════════════════════════════════════════════ */

  function open(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
  }

  function closeAll() {
    ['detailModal', 'formModal', 'howToModal'].forEach(close);
  }

  // Fermeture en cliquant sur l'overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAll();
    });
  });

  // Fermeture avec Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });

  /* Boutons de fermeture individuels */
  document.getElementById('closeDetailModal').addEventListener('click', () => close('detailModal'));
  document.getElementById('closeFormModal').addEventListener('click',  () => close('formModal'));
  document.getElementById('closeHowToModal').addEventListener('click', () => close('howToModal'));
  document.getElementById('cancelForm').addEventListener('click',      () => close('formModal'));


  /* ═══════════════════════════════════════════
     MODAL DÉTAIL SOLUTION
  ══════════════════════════════════════════════ */

  /**
   * Affiche la modale de détail pour une solution donnée.
   * @param {Object} sol - objet solution complet
   * @param {Function} onEdit   - callback pour l'édition
   * @param {Function} onDelete - callback pour la suppression
   */
  function openDetail(sol, onEdit, onDelete) {
    const catColor = Search.getCatColor(sol.category);

    // Catégorie badge
    const catEl = document.getElementById('detailCategory');
    catEl.textContent = sol.category;
    catEl.style.background = `${catColor}22`;
    catEl.style.color = catColor;
    catEl.style.border = `1px solid ${catColor}44`;

    document.getElementById('detailTitle').textContent    = sol.title;
    document.getElementById('detailProblem').textContent  = sol.problem;
    document.getElementById('detailSolution').textContent = sol.solution;

    // Tags
    const tagsEl = document.getElementById('detailTags');
    tagsEl.innerHTML = (sol.tags || [])
      .map(t => `<span class="tag">${escHtml(t)}</span>`)
      .join('');

    // Commandes
    const cmdsSection = document.getElementById('detailCommandsSection');
    const cmdsEl      = document.getElementById('detailCommands');
    const commands    = (sol.commands || []).filter(Boolean);

    if (commands.length) {
      cmdsSection.classList.remove('hidden');
      cmdsEl.innerHTML = commands.map(cmd => `
        <div class="command-row">
          <span class="command-text">${escHtml(cmd)}</span>
          <button class="copy-btn" data-cmd="${escHtml(cmd)}">Copy</button>
        </div>
      `).join('');

      // Boutons Copy
      cmdsEl.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => copyToClipboard(btn.dataset.cmd, btn));
      });
    } else {
      cmdsSection.classList.add('hidden');
    }

    // Date
    const date = sol.created_at
      ? new Date(sol.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';
    document.getElementById('detailDate').textContent = date ? `Ajouté le ${date}` : '';

    // Actions – visibles uniquement pour l'admin
    const isAdmin = typeof Auth !== 'undefined' && Auth.isAdmin();
    document.getElementById('btnEditSolution').style.display   = isAdmin ? '' : 'none';
    document.getElementById('btnDeleteSolution').style.display = isAdmin ? '' : 'none';

    document.getElementById('btnEditSolution').onclick   = () => { close('detailModal'); onEdit(sol); };
    document.getElementById('btnDeleteSolution').onclick = () => onDelete(sol.id);

    open('detailModal');
  }


  /* ═══════════════════════════════════════════
     MODAL FORMULAIRE
  ══════════════════════════════════════════════ */

  /**
   * Ouvre le formulaire en mode "Nouveau".
   */
  function openAdd(onSubmit) {
    _resetForm();
    document.getElementById('formModalTitle').textContent = 'Nouvelle solution';
    document.getElementById('submitLabel').textContent    = 'Enregistrer';
    document.getElementById('submitForm').onclick = () => _handleSubmit(null, onSubmit);
    open('formModal');
  }

  /**
   * Ouvre le formulaire en mode "Édition".
   * @param {Object}   sol      - solution à éditer
   * @param {Function} onSubmit - callback(data, id)
   */
  function openEdit(sol, onSubmit) {
    _resetForm();
    document.getElementById('formModalTitle').textContent = 'Modifier la solution';
    document.getElementById('submitLabel').textContent    = 'Mettre à jour';

    // Pré-remplir les champs
    document.getElementById('fTitle').value    = sol.title    || '';
    document.getElementById('fCategory').value = sol.category || '';
    document.getElementById('fProblem').value  = sol.problem  || '';
    document.getElementById('fSolution').value = sol.solution || '';
    document.getElementById('fCommands').value = (sol.commands || []).join('\n');
    document.getElementById('fTags').value     = (sol.tags || []).join(', ');

    document.getElementById('submitForm').onclick = () => _handleSubmit(sol.id, onSubmit);
    open('formModal');
  }

  function _resetForm() {
    ['fTitle', 'fProblem', 'fSolution', 'fCommands', 'fTags'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('fCategory').value = '';
    // Réinitialiser les erreurs éventuelles
    document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
  }

  function _handleSubmit(editId, onSubmit) {
    const title    = document.getElementById('fTitle').value.trim();
    const category = document.getElementById('fCategory').value;
    const problem  = document.getElementById('fProblem').value.trim();
    const solution = document.getElementById('fSolution').value.trim();
    const commands = document.getElementById('fCommands').value
      .split('\n').map(c => c.trim()).filter(Boolean);
    const tags     = document.getElementById('fTags').value
      .split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    // Validation basique
    let valid = true;
    [['fTitle', title], ['fCategory', category], ['fProblem', problem], ['fSolution', solution]]
      .forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!val) { el.classList.add('error'); valid = false; }
        else       { el.classList.remove('error'); }
      });

    if (!valid) {
      Toast.show('Veuillez remplir tous les champs obligatoires (*)', 'error');
      return;
    }

    const data = { title, category, problem, solution, commands, tags };
    onSubmit(data, editId);
    close('formModal');
  }


  /* ═══════════════════════════════════════════
     MODAL HOW-TO
  ══════════════════════════════════════════════ */

  function openHowTo() {
    open('howToModal');
  }


  /* ═══════════════════════════════════════════
     COPY TO CLIPBOARD
  ══════════════════════════════════════════════ */

  async function copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        btn.textContent = '✓ Copié';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 1800);
      }
      Toast.show('Commande copiée dans le presse-papiers ✓', 'success');
    } catch {
      Toast.show('Impossible de copier automatiquement.', 'error');
    }
  }


  /* ═══════════════════════════════════════════
     UTILITAIRE HTML
  ══════════════════════════════════════════════ */

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }


  return { openDetail, openAdd, openEdit, openHowTo, closeAll, close };
})();


/* ═══════════════════════════════════════════════
   TOAST – Notifications légères
═══════════════════════════════════════════════ */
const Toast = (() => {
  let timer;
  const el = document.getElementById('toast');

  function show(message, type = 'info', duration = 3000) {
    el.textContent = message;
    el.className = `toast ${type}`;
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  return { show };
})();
