/**
 * Admin Permissions Matrix — role × action grid
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var ROLES = ['patient', 'doctor', 'pharmacy', 'admin'];
  var ACTIONS = [
    { key: 'view_own_records', label: 'View own records' },
    { key: 'book_appointments', label: 'Book appointments' },
    { key: 'issue_prescription', label: 'Issue prescriptions' },
    { key: 'revoke_prescription', label: 'Revoke prescriptions' },
    { key: 'dispense_order', label: 'Dispense orders' },
    { key: 'manage_inventory', label: 'Manage inventory' },
    { key: 'run_pos', label: 'Run POS' },
    { key: 'view_all_patients', label: 'View all patients' },
    { key: 'create_accounts', label: 'Create staff accounts' },
    { key: 'approve_withdrawals', label: 'Approve withdrawals' },
    { key: 'manage_content', label: 'Manage CMS content' },
    { key: 'view_audit_logs', label: 'View audit logs' },
    { key: 'export_data', label: 'Export CSV data' },
  ];

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Permissions · 權限矩陣</div>' +
      '<h1 class="page-title">Role-Based Access Control</h1>' +
      '</div><div id="pm-body"></div>';

    var body = document.getElementById('pm-body');
    HM.state.loading(body);
    try {
      var res = await HM.api.admin.getPermissions();
      var matrix = res.permissions || res || {};

      var header = '<thead><tr><th style="min-width: 200px;">Action · 操作</th>';
      ROLES.forEach(function (r) {
        header += '<th style="text-align:center; text-transform: capitalize;">' + r + '</th>';
      });
      header += '</tr></thead>';

      var rows = '<tbody>';
      ACTIONS.forEach(function (a) {
        rows += '<tr><td><strong>' + a.label + '</strong><br><code style="font-size: var(--text-xs); color: var(--stone);">' + a.key + '</code></td>';
        ROLES.forEach(function (r) {
          var checked = matrix[r] && matrix[r][a.key] ? 'checked' : '';
          rows += '<td style="text-align:center;"><input type="checkbox" data-role="' + r + '" data-action="' + a.key + '" ' + checked + ' style="width: 20px; height: 20px;"></td>';
        });
        rows += '</tr>';
      });
      rows += '</tbody>';

      body.innerHTML = '<div class="alert alert--warning mb-4">' +
        '<strong>⚠️ Warning</strong><br>' +
        'Changing permissions affects all users of that role immediately. Admin role always has full access.</div>' +
        '<div class="card"><div class="table-wrap"><table class="table">' + header + rows + '</table></div>' +
        '<div class="flex-between mt-4"><div class="text-sm text-muted">' + ACTIONS.length + ' actions × ' + ROLES.length + ' roles</div>' +
        '<button class="btn btn--primary" id="save-perms">Save Changes</button></div></div>';

      document.getElementById('save-perms').addEventListener('click', async function () {
        var btn = this;
        btn.disabled = true;
        var data = {};
        ROLES.forEach(function (r) { data[r] = {}; });
        body.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          var r = cb.getAttribute('data-role');
          var a = cb.getAttribute('data-action');
          data[r][a] = cb.checked;
        });
        try {
          await HM.api.admin.setPermissions(data);
          HM.ui.toast('Permissions saved · 權限已保存', 'success');
        } catch (e) { HM.ui.toast(e.message, 'danger'); }
        finally { btn.disabled = false; }
      });
    } catch (e) { HM.state.error(body, e); }
  }

  HM.adminPanels.permissions = { render: render };
})();
