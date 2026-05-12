/**
 * Admin Audit Log Viewer
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var filters = { action: '', user_id: '', from: '', to: '' };

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Audit Logs · 審計日誌</div>' +
      '<h1 class="page-title">System Activity Log</h1>' +
      '</div>' +
      '<div class="card mb-4">' +
      '<div class="field-grid field-grid--4">' +
      '<div class="field"><label class="field-label">Action</label>' +
      '<input id="f-action" class="field-input field-input--boxed" placeholder="e.g. login, create"></div>' +
      '<div class="field"><label class="field-label">User ID</label>' +
      '<input id="f-user" type="number" class="field-input field-input--boxed"></div>' +
      '<div class="field"><label class="field-label">From</label>' +
      '<input id="f-from" type="date" class="field-input field-input--boxed"></div>' +
      '<div class="field"><label class="field-label">To</label>' +
      '<input id="f-to" type="date" class="field-input field-input--boxed"></div>' +
      '</div>' +
      '<div class="flex gap-2"><button class="btn btn--primary btn--sm" id="apply-filters">Apply</button>' +
      '<button class="btn btn--ghost btn--sm" id="clear-filters">Clear</button></div>' +
      '</div>' +
      '<div id="audit-list"></div>';

    document.getElementById('apply-filters').addEventListener('click', function () {
      filters.action = document.getElementById('f-action').value;
      filters.user_id = document.getElementById('f-user').value;
      filters.from = document.getElementById('f-from').value;
      filters.to = document.getElementById('f-to').value;
      load();
    });
    document.getElementById('clear-filters').addEventListener('click', function () {
      filters = { action: '', user_id: '', from: '', to: '' };
      document.getElementById('f-action').value = '';
      document.getElementById('f-user').value = '';
      document.getElementById('f-from').value = '';
      document.getElementById('f-to').value = '';
      load();
    });
    await load();
  }

  async function load() {
    var container = document.getElementById('audit-list');
    HM.state.loading(container);
    try {
      var q = [];
      if (filters.action) q.push('action=' + encodeURIComponent(filters.action));
      if (filters.user_id) q.push('user_id=' + filters.user_id);
      if (filters.from) q.push('from=' + filters.from);
      if (filters.to) q.push('to=' + filters.to);
      var res = await HM.api.admin.auditLogs(q.join('&'));
      var items = (res.data && res.data.data) || res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📜', title: 'No audit logs', text: 'Activity will appear here as users interact with the system' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>IP</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (log) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Time">' + HM.format.date(log.created_at) + ' ' + HM.format.time(log.created_at) + '</td>' +
          '<td data-label="User">#' + (log.user_id || '—') + '</td>' +
          '<td data-label="Action"><code>' + HM.format.esc(log.action) + '</code></td>' +
          '<td data-label="Target">' + HM.format.esc(log.target_type || '—') + (log.target_id ? ' #' + log.target_id : '') + '</td>' +
          '<td data-label="IP">' + HM.format.esc(log.ip_address || '—') + '</td>' +
          '<td data-label="Payload">' + (log.payload ? '<button class="btn btn--ghost btn--sm" data-view>View</button>' : '—') + '</td>';
        var viewBtn = tr.querySelector('[data-view]');
        if (viewBtn) {
          viewBtn.addEventListener('click', function () {
            HM.ui.modal({
              size: 'md',
              title: 'Audit Entry #' + log.id,
              content: '<pre style="background: var(--bg-soft); padding: var(--s-3); border-radius: var(--r-md); font-size: var(--text-sm); overflow: auto; max-height: 400px;">' + HM.format.esc(JSON.stringify(log.payload, null, 2)) + '</pre>',
            });
          });
        }
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  HM.adminPanels.audit = { render: render };
})();
