/**
 * FixVault – dashboard.js
 * Tableau de bord analytics côté client
 */

const Dashboard = (() => {
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function computeStats(solutions) {
    const categories = {};
    const tags = {};
    let commands = 0;

    (solutions || []).forEach(sol => {
      categories[sol.category] = (categories[sol.category] || 0) + 1;
      (sol.tags || []).forEach(tag => {
        tags[tag] = (tags[tag] || 0) + 1;
      });
      commands += (sol.commands || []).length;
    });

    return {
      total: solutions.length,
      categoriesCount: Object.keys(categories).length,
      tagsCount: Object.keys(tags).length,
      commands,
      topCategories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 8),
      topTags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 14),
      monthly: computeMonthly(solutions),
      recent: [...solutions]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 6),
    };
  }

  function computeMonthly(solutions) {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({
        key,
        label: d.toLocaleDateString('fr-FR', { month: 'short' }),
        count: 0,
      });
    }

    (solutions || []).forEach(sol => {
      if (!sol.created_at) return;
      const d = new Date(sol.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.find(b => b.key === key);
      if (bucket) bucket.count += 1;
    });

    return buckets;
  }

  function renderBars(rows) {
    if (!rows.length) return '<p style="color:var(--text-muted)">Aucune donnée.</p>';
    const max = Math.max(...rows.map(r => r[1] || r.count || 0), 1);
    return rows.map(row => {
      const label = Array.isArray(row) ? row[0] : row.label;
      const count = Array.isArray(row) ? row[1] : row.count;
      const width = Math.max(8, Math.round((count / max) * 100));
      return `
        <div class="chart-row">
          <div class="chart-row-top">
            <span>${escapeHtml(label)}</span>
            <strong>${count}</strong>
          </div>
          <div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderTags(tags) {
    if (!tags.length) return '<p style="color:var(--text-muted)">Aucun tag.</p>';
    return tags.map(([tag, count]) => `<span class="tag">${escapeHtml(tag)} · ${count}</span>`).join('');
  }

  function renderRecent(items) {
    if (!items.length) return '<p style="color:var(--text-muted)">Aucune activité récente.</p>';
    return items.map(sol => `
      <div class="recent-item">
        <strong>${escapeHtml(sol.title)}</strong>
        <span>${escapeHtml(sol.category)}</span>
        <small>${sol.created_at ? new Date(sol.created_at).toLocaleDateString('fr-FR') : '—'}</small>
      </div>
    `).join('');
  }

  function open(solutions) {
    const stats = computeStats(solutions || []);

    const map = {
      dashTotal: stats.total,
      dashCategories: stats.categoriesCount,
      dashTags: stats.tagsCount,
      dashCommands: stats.commands,
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    });

    const topCategories = document.getElementById('topCategories');
    const topTags = document.getElementById('topTags');
    const monthlyChart = document.getElementById('monthlyChart');
    const recentActivity = document.getElementById('recentActivity');

    if (topCategories) topCategories.innerHTML = renderBars(stats.topCategories);
    if (topTags) topTags.innerHTML = renderTags(stats.topTags);
    if (monthlyChart) monthlyChart.innerHTML = renderBars(stats.monthly);
    if (recentActivity) recentActivity.innerHTML = renderRecent(stats.recent);

    const modal = document.getElementById('dashboardModal');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  return { open };
})();
