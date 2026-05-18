/**
 * Admin Error Dashboard · 錯誤監控
 *
 * Reads from GET /api/admin/system/errors using the admin's Sanctum
 * Bearer token. Displays errors grouped by fingerprint with level
 * badges, source, occurrence count, file:line, and timestamps.
 *
 * Auth: the admin path is gated by 'auth:sanctum' + 'role:admin' at
 * the route layer. The IT-agent path (/api/agent/errors) is gated by
 * the 'agent.token' middleware using HANSMED_AGENT_TOKEN. Both paths
 * reach the same controller method, so the dashboard sees the same
 * JSONL the agent does.
 *
 * Auto-refreshes every 30 seconds.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var REFRESH_INTERVAL = 30 * 1000;
  var refreshTimer     = null;
  var currentLevel     = 'error';
  var currentMinutes   = 60;

  // ─── Render entry point ───────────────────────────────────────────────────

  async function render(el) {
    clearInterval(refreshTimer);

    el.innerHTML =
      '<div class="page-header flex-between">' +
        '<div>' +
          '<div class="page-header-label">System · 系統</div>' +
          '<h1 class="page-title">Error Dashboard · 錯誤監控</h1>' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;">' +
          '<select id="err-window" class="input" style="width:auto;">' +
            '<option value="60">Last 1 hour</option>' +
            '<option value="360">Last 6 hours</option>' +
            '<option value="1440">Last 24 hours</option>' +
            '<option value="10080">Last 7 days</option>' +
          '</select>' +
          '<button class="btn btn--secondary" id="err-refresh" style="gap:0.3rem;">↻ Refresh</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;">' +
        levelChip('error',    '🔴 Errors')   +
        levelChip('warning',  '⚠️ Warnings') +
        levelChip('critical', '🚨 Critical') +
      '</div>' +
      '<div id="err-stats" style="display:flex;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap;"></div>' +
      '<div id="err-list"></div>';

    document.querySelectorAll('.err-level-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.err-level-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        currentLevel = c.getAttribute('data-level');
        load();
      });
    });

    document.getElementById('err-window').addEventListener('change', function () {
      currentMinutes = parseInt(this.value, 10);
      load();
    });

    document.getElementById('err-refresh').addEventListener('click', load);

    await load();

    refreshTimer = setInterval(load, REFRESH_INTERVAL);
  }

  function levelChip(level, label) {
    return '<button class="filter-chip err-level-chip' + (level === currentLevel ? ' is-active' : '') +
           '" data-level="' + level + '">' + label + '</button>';
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function load() {
    var listEl  = document.getElementById('err-list');
    var statsEl = document.getElementById('err-stats');
    if (!listEl) return;

    HM.state.loading(listEl);

    try {
      var since = new Date(Date.now() - currentMinutes * 60 * 1000).toISOString();
      var res   = await HM.api.get('/admin/system/errors?since=' + encodeURIComponent(since) + '&level=warning');
      var errors = res.errors || [];

      renderStats(statsEl, errors);
      renderList(listEl, errors, currentLevel);
    } catch (err) {
      listEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">⚠️</div>' +
          '<div class="empty-state-title">Could not load errors</div>' +
          '<div class="empty-state-text">' + (err && err.message ? err.message : 'API unavailable') + '</div>' +
        '</div>';
    }
  }

  // ─── Stats bar ────────────────────────────────────────────────────────────

  function renderStats(el, errors) {
    if (!el) return;
    var counts = { critical: 0, error: 0, warning: 0, backend: 0, frontend: 0 };
    errors.forEach(function (e) {
      counts[e.level]  = (counts[e.level]  || 0) + 1;
      counts[e.source] = (counts[e.source] || 0) + 1;
    });

    el.innerHTML =
      statCard('🚨', counts.critical, 'Critical',  '#8e44ad') +
      statCard('🔴', counts.error,    'Errors',     '#e74c3c') +
      statCard('⚠️', counts.warning,  'Warnings',   '#f39c12') +
      statCard('⚙️', counts.backend,  'Backend',    '#2980b9') +
      statCard('🖥️', counts.frontend, 'Frontend',   '#27ae60');
  }

  function statCard(icon, count, label, color) {
    return '<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-md);padding:0.75rem 1.25rem;min-width:110px;text-align:center;">' +
      '<div style="font-size:1.5rem;font-weight:700;color:' + color + ';">' + (count || 0) + '</div>' +
      '<div style="font-size:0.78rem;color:var(--c-text-secondary);">' + icon + ' ' + label + '</div>' +
    '</div>';
  }

  // ─── Error list ───────────────────────────────────────────────────────────

  function renderList(el, errors, filterLevel) {
    var levelOrder = { critical: 2, error: 1, warning: 0 };
    var minOrdinal = levelOrder[filterLevel] ?? 1;

    var filtered = errors.filter(function (e) {
      return (levelOrder[e.level] ?? 1) >= minOrdinal;
    });

    // Group by fingerprint, keep most severe + latest
    var groups = {};
    filtered.forEach(function (e) {
      var fp = e.fingerprint;
      if (!groups[fp]) {
        groups[fp] = Object.assign({}, e, { count: 1 });
      } else {
        groups[fp].count++;
        if (e.timestamp > groups[fp].last_seen) groups[fp].last_seen = e.timestamp;
        if ((levelOrder[e.level] ?? 1) > (levelOrder[groups[fp].level] ?? 1)) {
          groups[fp].level = e.level;
        }
      }
      if (!groups[fp].first_seen) groups[fp].first_seen = e.timestamp;
      groups[fp].last_seen = groups[fp].last_seen || e.timestamp;
    });

    var sorted = Object.values(groups).sort(function (a, b) {
      var lvDiff = (levelOrder[b.level] ?? 1) - (levelOrder[a.level] ?? 1);
      if (lvDiff !== 0) return lvDiff;
      return (b.last_seen || '').localeCompare(a.last_seen || '');
    });

    if (!sorted.length) {
      el.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">✅</div>' +
          '<div class="empty-state-title">No ' + filterLevel + '-level errors</div>' +
          '<div class="empty-state-text">System is healthy in the selected window.</div>' +
        '</div>';
      return;
    }

    el.innerHTML = sorted.map(function (g) { return errorCard(g); }).join('');
  }

  // ─── Error card ───────────────────────────────────────────────────────────

  var LEVEL_COLORS = { critical: '#8e44ad', error: '#e74c3c', warning: '#f39c12' };
  var LEVEL_ICONS  = { critical: '🚨', error: '🔴', warning: '⚠️' };

  function errorCard(g) {
    var color    = LEVEL_COLORS[g.level]  || '#e74c3c';
    var icon     = LEVEL_ICONS[g.level]   || '🔴';
    var shortFp  = (g.fingerprint || '').slice(0, 12) + '…';
    var fileInfo = g.file ? (g.file.replace(/.*[/\\]/, '') + (g.line ? ':' + g.line : '')) : 'unknown';

    return '<div style="background:var(--c-surface);border:1px solid var(--c-border);border-left:4px solid ' + color + ';border-radius:var(--r-md);padding:1rem 1.25rem;margin-bottom:0.75rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">' +
        '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">' +
          '<span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:' + color + ';">' + icon + ' ' + g.level + '</span>' +
          '<span style="background:rgba(0,0,0,0.06);border-radius:999px;padding:0.1rem 0.6rem;font-size:0.72rem;color:var(--c-text-secondary);">' + g.source + '</span>' +
          (g.count > 1 ? '<span style="background:' + color + ';color:#fff;border-radius:999px;padding:0.1rem 0.6rem;font-size:0.72rem;">' + g.count + '×</span>' : '') +
        '</div>' +
        '<span style="font-size:0.72rem;color:var(--c-text-secondary);">fp: ' + shortFp + '</span>' +
      '</div>' +
      '<div style="font-weight:600;margin:0.4rem 0 0.2rem;word-break:break-word;">' + esc(g.type || 'Error') + '</div>' +
      '<div style="color:var(--c-text-secondary);font-size:0.88rem;word-break:break-word;">' + esc(g.message || '') + '</div>' +
      '<div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:0.6rem;font-size:0.78rem;color:var(--c-text-secondary);">' +
        '<span>📁 ' + esc(fileInfo) + '</span>' +
        (g.first_seen ? '<span>First: ' + fmtDate(g.first_seen) + '</span>' : '') +
        (g.last_seen  ? '<span>Last: '  + fmtDate(g.last_seen)  + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }) + ' ' +
             d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (_) { return iso; }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  HM.adminPanels.errorDashboard = { render: render };

})();
