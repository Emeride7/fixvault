/**
 * FixVault – modal.js
 * Gestion de toutes les modales
 */

const Modal = (() => {

  function open(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function closeAll() {
    ['detailModal', 'formModal', 'howToModal', 'categoriesModal', 'dashboardModal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAll();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });

  const closeDetail = document.getElementById('closeDetailModal');
  if (closeDetail) closeDetail.addEventListener('click', () => close('detailModal'));
  
  const closeForm = document.getElementById('closeFormModal');
  if (closeForm) closeForm.addEventListener('click', () => close('formModal'));
  
  const closeHowTo = document.getElementById('closeHowToModal');
  if (closeHowTo) closeHowTo.addEventListener('click', () => close('howToModal'));
  
  const cancelForm = document.getElementById('cancelForm');
  if (cancelForm) cancelForm.addEventListener('click', () => close('formModal'));

  /* ═══════════════════════════════════════════
     MODAL DÉTAIL
  ══════════════════════════════════════════════ */
  function openDetail(sol, onEdit, onDelete) {
    const catColor = CategoriesManager.getColor(sol.category);

    const catEl = document.getElementById('detailCategory');
    if (catEl) {
      catEl.textContent = sol.category;
      catEl.style.background = `${catColor}22`;
      catEl.style.color = catColor;
      catEl.style.border = `1px solid ${catColor}44`;
    }

    const titleEl = document.getElementById('detailTitle');
    if (titleEl) titleEl.textContent = sol.title;
    
    const problemEl = document.getElementById('detailProblem');
    if (problemEl) problemEl.textContent = sol.problem;
    
    const solutionEl = document.getElementById('detailSolution');
    if (solutionEl) solutionEl.textContent = sol.solution;

    const tagsEl = document.getElementById('detailTags');
    if (tagsEl) {
      tagsEl.innerHTML = (sol.tags || [])
        .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
        .join('');
    }

    const cmdsSection = document.getElementById('detailCommandsSection');
    const cmdsEl = document.getElementById('detailCommands');
    const commands = (sol.commands || []).filter(Boolean);

    if (cmdsSection && cmdsEl) {
      if (commands.length) {
        cmdsSection.classList.remove('hidden');
        cmdsEl.innerHTML = commands.map(cmd => `
          <div class="command-row">
            <span class="command-text">${escapeHtml(cmd)}</span>
            <button class="copy-btn" data-cmd="${escapeHtml(cmd)}">Copy</button>
          </div>
        `).join('');

        cmdsEl.querySelectorAll('.copy-btn').forEach(btn => {
          btn.addEventListener('click', () => copyToClipboard(btn.dataset.cmd, btn));
        });
      } else {
        cmdsSection.classList.add('hidden');
      }
    }

    const dateEl = document.getElementById('detailDate');
    if (dateEl) {
      const date = sol.created_at
        ? new Date(sol.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';
      dateEl.textContent = date ? `Ajouté le ${date}` : '';
    }

    const isAdmin = typeof Auth !== 'undefined' && Auth.isAdmin();
    
    const editBtn = document.getElementById('btnEditSolution');
    const deleteBtn = document.getElementById('btnDeleteSolution');
    
    if (editBtn) editBtn.style.display = isAdmin ? '' : 'none';
    if (deleteBtn) deleteBtn.style.display = isAdmin ? '' : 'none';

    if (editBtn) {
      editBtn.onclick = () => { close('detailModal'); onEdit(sol); };
    }
    if (deleteBtn) {
      deleteBtn.onclick = () => onDelete(sol.id);
    }

    open('detailModal');
  }

  /* ═══════════════════════════════════════════
     MODAL FORMULAIRE
  ══════════════════════════════════════════════ */
  function openAdd(onSubmit) {
    resetForm();
    updateCategorySelectInModal();
    
    const titleEl = document.getElementById('formModalTitle');
    if (titleEl) titleEl.textContent = 'Nouvelle solution';
    
    const submitLabel = document.getElementById('submitLabel');
    if (submitLabel) submitLabel.textContent = 'Enregistrer';
    
    const submitBtn = document.getElementById('submitForm');
    if (submitBtn) submitBtn.onclick = () => handleSubmit(null, onSubmit);
    
    open('formModal');
  }

  function openEdit(sol, onSubmit) {
    resetForm();
    updateCategorySelectInModal();
    
    const titleEl = document.getElementById('formModalTitle');
    if (titleEl) titleEl.textContent = 'Modifier la solution';
    
    const submitLabel = document.getElementById('submitLabel');
    if (submitLabel) submitLabel.textContent = 'Mettre à jour';

    const fTitle = document.getElementById('fTitle');
    if (fTitle) fTitle.value = sol.title || '';
    
    const fCategory = document.getElementById('fCategory');
    if (fCategory) fCategory.value = sol.category || '';
    
    const fProblem = document.getElementById('fProblem');
    if (fProblem) fProblem.value = sol.problem || '';
    
    const fSolution = document.getElementById('fSolution');
    if (fSolution) fSolution.value = sol.solution || '';
    
    const fCommands = document.getElementById('fCommands');
    if (fCommands) fCommands.value = (sol.commands || []).join('\n');
    
    const fTags = document.getElementById('fTags');
    if (fTags) fTags.value = (sol.tags || []).join(', ');

    const submitBtn = document.getElementById('submitForm');
    if (submitBtn) submitBtn.onclick = () => handleSubmit(sol.id, onSubmit);
    
    open('formModal');
  }

  function updateCategorySelectInModal() {
    const select = document.getElementById('fCategory');
    if (select && window.CategoriesManager) {
      const currentValue = select.value;
      select.innerHTML = '<option value="">— Choisir —</option>' + CategoriesManager.getOptionsHtml();
      if (currentValue) select.value = currentValue;
    }
  }

  function resetForm() {
    const fields = ['fTitle', 'fProblem', 'fSolution', 'fCommands', 'fTags'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    const category = document.getElementById('fCategory');
    if (category) category.value = '';
    
    document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
  }

  function handleSubmit(editId, onSubmit) {
    const titleEl = document.getElementById('fTitle');
    const categoryEl = document.getElementById('fCategory');
    const problemEl = document.getElementById('fProblem');
    const solutionEl = document.getElementById('fSolution');
    const commandsEl = document.getElementById('fCommands');
    const tagsEl = document.getElementById('fTags');

    const title = titleEl ? titleEl.value.trim() : '';
    const category = categoryEl ? categoryEl.value : '';
    const problem = problemEl ? problemEl.value.trim() : '';
    const solution = solutionEl ? solutionEl.value.trim() : '';
    const commands = commandsEl ? commandsEl.value.split('\n').map(c => c.trim()).filter(Boolean) : [];
    const tags = tagsEl ? tagsEl.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    let valid = true;
    const required = [
      { id: 'fTitle', value: title },
      { id: 'fCategory', value: category },
      { id: 'fProblem', value: problem },
      { id: 'fSolution', value: solution }
    ];

    required.forEach(({ id, value }) => {
      const el = document.getElementById(id);
      if (el) {
        if (!value) {
          el.classList.add('error');
          valid = false;
        } else {
          el.classList.remove('error');
        }
      }
    });

    if (!valid) {
      if (typeof Toast !== 'undefined') {
        Toast.show('Veuillez remplir tous les champs obligatoires (*)', 'error');
      }
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
      if (typeof Toast !== 'undefined') {
        Toast.show('Commande copiée dans le presse-papiers ✓', 'success');
      }
    } catch {
      if (typeof Toast !== 'undefined') {
        Toast.show('Impossible de copier automatiquement.', 'error');
      }
    }
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { openDetail, openAdd, openEdit, openHowTo, closeAll, close };
})();

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
const Toast = (() => {
  let timer;
  const el = document.getElementById('toast');

  function show(message, type = 'info', duration = 3000) {
    if (!el) return;
    el.textContent = message;
    el.className = `toast ${type}`;
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  return { show };
})();