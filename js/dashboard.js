/**
 * FixVault – dashboard.js
 * Statistiques avancées, graphiques, export/import JSON
 */

const Dashboard = (() => {

  function getStats(solutions) {
    const total = solutions.length;
    const uniqueCategories = [...new Set(solutions.map(s => s.category))];
    const categoriesCount = uniqueCategories.length;
    const allTags = solutions.flatMap(s => s.tags || []);
    const uniqueTags = [...new Set(allTags)];
    const tagsCount = uniqueTags.length;
    const commandsCount = solutions.reduce((sum, s) => sum + (s.commands || []).length, 0);
    return { total, categoriesCount, tagsCount, commandsCount };
  }

  function getTopCategories(solutions, limit = 5) {
    const counts = {};
    solutions.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count, percentage: (count / solutions.length) * 100 }));
  }

  function getTopTags(solutions, limit = 10) {
    const counts = {};
    solutions.forEach(s => {
      (s.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  function getRecentActivity(solutions, limit = 5) {
    return [...solutions]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(sol => ({
        title: sol.title,
        category: sol.category,
        date: new Date(sol.created_at).toLocaleDateString('fr-FR')
      }));
  }

  function getMonthlyEvolution(solutions) {
    const months = {};
    solutions.forEach(sol => {
      if (sol.created_at) {
        const date = new Date(sol.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + 1;
      }
    });
    const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
    const maxCount = Math.max(...Object.values(months), 1);
    return sorted.map(([month, count]) => ({ month, count, percentage: (count / maxCount) * 100 }));
  }

  function renderStats(stats) {
    const totalEl = document.getElementById('dashTotal');
    const categoriesEl = document.getElementById('dashCategories');
    const tagsEl = document.getElementById('dashTags');
    const commandsEl = document.getElementById('dashCommands');
    if (totalEl) totalEl.textContent = stats.total;
    if (categoriesEl) categoriesEl.textContent = stats.categoriesCount;
    if (tagsEl) tagsEl.textContent = stats.tagsCount;
    if (commandsEl) commandsEl.textContent = stats.commandsCount;
  }

  function renderTopCategories(categories) {
    const container = document.getElementById('topCategories');
    if (!container) return;
    container.innerHTML = categories.map(cat => `
      <div class="top-item">
        <span class="top-name">${escapeHtml(cat.name)}</span>
        <div class="top-bar-container">
          <div class="top-bar" style="width:${cat.percentage}%;background:${CategoriesManager.getColor(cat.name)}"></div>
        </div>
        <span class="top-count">${cat.count}</span>
      </div>
    `).join('');
  }

  function renderTopTags(tags) {
    const container = document.getElementById('topTags');
    if (!container) return;
    container.innerHTML = tags.map(tag => `
      <span class="tag-stat">${escapeHtml(tag.name)} (${tag.count})</span>
    `).join('');
  }

  function renderRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    container.innerHTML = activities.map(act => `
      <div class="recent-item">
        <span class="recent-title">${escapeHtml(act.title)}</span>
        <span class="recent-cat">${escapeHtml(act.category)}</span>
        <span class="recent-date">${act.date}</span>
      </div>
    `).join('');
  }

  function renderMonthlyChart(months) {
    const container = document.getElementById('monthlyChart');
    if (!container) return;
    container.innerHTML = months.map(month => `
      <div class="chart-bar-item">
        <span class="chart-bar-label">${month.month}</span>
        <div class="chart-bar-container">
          <div class="chart-bar" style="height:${month.percentage}%;background:var(--accent)"></div>
        </div>
        <span class="chart-bar-value">${month.count}</span>
      </div>
    `).join('');
  }

  function open(solutions) {
    if (!solutions || solutions.length === 0) {
      Toast.show('Aucune donnée à afficher', 'info');
      return;
    }
    const stats = getStats(solutions);
    const topCategories = getTopCategories(solutions);
    const topTags = getTopTags(solutions);
    const recentActivity = getRecentActivity(solutions);
    const monthlyEvolution = getMonthlyEvolution(solutions);

    renderStats(stats);
    renderTopCategories(topCategories);
    renderTopTags(topTags);
    renderRecentActivity(recentActivity);
    renderMonthlyChart(monthlyEvolution);

    const modal = document.getElementById('dashboardModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function close() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  function exportJSON(solutions) {
    const blob = new Blob([JSON.stringify(solutions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixvault-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Export JSON téléchargé ✓', 'success');
  }

  function importJSON(file, onLoaded) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('Format invalide');
        onLoaded(data);
        Toast.show('Import réussi ✓', 'success');
      } catch (err) {
        Toast.show('Erreur lors de l\'import : ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { open, close, exportJSON, importJSON, getStats, getTopCategories, getTopTags, getRecentActivity, getMonthlyEvolution };
})();
