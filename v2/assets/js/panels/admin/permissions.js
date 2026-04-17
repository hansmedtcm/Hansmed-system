/**
 * Admin Permissions Matrix — role × action grid
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var ROLES = ['patient', 'doctor', 'pharmacy', 'admin'];
  // Permissions are grouped so the matrix stays readable as it grows.
  // Admin always has full access regardless — these toggles govern
  // non-admin roles and, for the "admin-only tab" section, which
  // sub-admins may see that tab (once multi-tier admin is introduced).
  var GROUPS = [
    {
      label: 'Clinical · 臨床',
      actions: [
        { key: 'view_own_records',   label: 'View own records' },
        { key: 'book_appointments',  label: 'Book appointments' },
        { key: 'issue_prescription', label: 'Issue prescriptions' },
        { key: 'revoke_prescription', label: 'Revoke prescriptions' },
        { key: 'view_all_patients',  label: 'View all patients' },
      ],
    },
    {
      label: 'Pharmacy · 藥房',
      actions: [
        { key: 'dispense_order',     label: 'Dispense orders' },
        { key: 'manage_inventory',   label: 'Manage inventory' },
        { key: 'run_pos',            label: 'Run POS (cashier)' },
        { key: 'manage_medicine_catalog', label: 'Manage medicine catalog' },
      ],
    },
    {
      label: 'Admin Tabs · 管理分頁',
      actions: [
        { key: 'admin_access_finance',      label: 'Access Finance tab' },
        { key: 'admin_access_withdrawals',  label: 'Access Withdrawals tab' },
        { key: 'admin_access_accounts',     label: 'Access Accounts tab' },
        { key: 'admin_access_patients',     label: 'Access Patients tab' },
        { key: 'admin_access_doctors',      label: 'Access Doctors tab' },
        { key: 'admin_access_verifications', label: 'Access Verifications tab' },
        { key: 'admin_access_appointments', label: 'Access Appointments tab' },
        { key: 'admin_access_prescriptions', label: 'Access Prescriptions tab' },
        { key: 'admin_access_orders',       label: 'Access Orders tab' },
        { key: 'admin_access_shop_catalog', label: 'Access Shop Catalog tab' },
        { key: 'admin_access_medicine_catalog', label: 'Access Medicine Catalog tab' },
        { key: 'admin_access_content',      label: 'Access Content/CMS tab' },
        { key: 'admin_access_tongue_config', label: 'Access Tongue Config tab' },
        { key: 'admin_access_permissions',  label: 'Access Permissions tab' },
        { key: 'admin_access_audit',        label: 'Access Audit Logs tab' },
        { key: 'admin_access_settings',     label: 'Access System Settings tab' },
      ],
    },
    {
      label: 'Admin Actions · 管理操作',
      actions: [
        { key: 'create_accounts',      label: 'Create staff accounts' },
        { key: 'edit_accounts',        label: 'Edit accounts · 編輯帳號' },
        { key: 'reset_passwords',      label: 'Reset user passwords' },
        { key: 'suspend_accounts',     label: 'Suspend / activate accounts' },
        { key: 'approve_withdrawals',  label: 'Approve withdrawals' },
        { key: 'approve_verifications', label: 'Approve doctor/pharmacy verifications' },
        { key: 'manage_content',       label: 'Manage CMS content' },
        { key: 'view_audit_logs',      label: 'View audit logs' },
        { key: 'export_data',          label: 'Export CSV data' },
        { key: 'revoke_prescription_admin', label: 'Revoke prescriptions (admin override)' },
        { key: 'view_all_finance',     label: 'View all finance data (incl. doctor earnings)' },
        { key: 'manage_permissions',   label: 'Manage permissions matrix' },
      ],
    },
  ];
  // Flattened list used by the save-data collector
  var ACTIONS = GROUPS.reduce(function (acc, g) { return acc.concat(g.actions); }, []);
  // Defaults — what a fresh platform should start with
  var DEFAULTS = {
    patient:  { view_own_records: true, book_appointments: true },
    doctor:   { view_own_records: true, issue_prescription: true, revoke_prescription: true, view_all_patients: true },
    pharmacy: { dispense_order: true, manage_inventory: true, run_pos: true },
    admin:    ACTIONS.reduce(function (a, x) { a[x.key] = true; return a; }, {}),
  };

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
      // Seed defaults for any missing role/action so the checkboxes show
      // sensible initial state rather than all-off on first visit.
      ROLES.forEach(function (r) {
        if (!matrix[r]) matrix[r] = {};
        Object.keys(DEFAULTS[r] || {}).forEach(function (k) {
          if (matrix[r][k] === undefined) matrix[r][k] = DEFAULTS[r][k];
        });
      });

      var header = '<thead><tr><th style="min-width: 260px;">Action · 操作</th>';
      ROLES.forEach(function (r) {
        header += '<th style="text-align:center; text-transform: capitalize;">' + r +
          '<div style="font-size: var(--text-xs); color: var(--stone); font-weight: 400; margin-top:2px;">' +
          '<button class="perm-col-toggle" data-col="' + r + '" data-all="1" type="button">all</button> · ' +
          '<button class="perm-col-toggle" data-col="' + r + '" data-all="0" type="button">none</button>' +
          '</div>' +
          '</th>';
      });
      header += '</tr></thead>';

      var rows = '<tbody>';
      GROUPS.forEach(function (g) {
        rows += '<tr class="perm-group-head"><td colspan="' + (ROLES.length + 1) + '" style="background:var(--washi);padding: var(--s-2) var(--s-3);font-weight:600;font-size:var(--text-xs);letter-spacing:.08em;color:var(--stone);text-transform:uppercase;">' +
          HM.format.esc(g.label) +
          '</td></tr>';
        g.actions.forEach(function (a) {
          rows += '<tr>' +
            '<td><strong>' + HM.format.esc(a.label) + '</strong><br>' +
            '<code style="font-size: var(--text-xs); color: var(--stone);">' + a.key + '</code></td>';
          ROLES.forEach(function (r) {
            var checked = matrix[r] && matrix[r][a.key] ? 'checked' : '';
            rows += '<td style="text-align:center;"><input type="checkbox" data-role="' + r + '" data-action="' + a.key + '" ' + checked + ' style="width: 20px; height: 20px;"></td>';
          });
          rows += '</tr>';
        });
      });
      rows += '</tbody>';

      body.innerHTML = '<div class="alert alert--warning mb-4">' +
        '<strong>⚠️ Changes take effect immediately for all users of that role.</strong> ' +
        'Admin role has full access by default — unchecking admin cells reserves that permission for a future "super-admin" tier. ' +
        '<span style="font-family: var(--font-zh);">修改立即生效。管理員預設擁有全部權限。</span>' +
        '</div>' +
        '<div class="card"><div class="table-wrap"><table class="table">' + header + rows + '</table></div>' +
        '<div class="flex-between mt-4" style="flex-wrap:wrap;gap:var(--s-2);">' +
        '<div class="text-sm text-muted">' + ACTIONS.length + ' actions × ' + ROLES.length + ' roles · ' + GROUPS.length + ' groups</div>' +
        '<div class="flex gap-2">' +
          '<button class="btn btn--ghost" id="perm-reset">↺ Restore Defaults</button>' +
          '<button class="btn btn--primary" id="save-perms">💾 Save Changes</button>' +
        '</div></div></div>' +
        '<style>.perm-col-toggle{background:none;border:none;color:var(--stone);cursor:pointer;text-decoration:underline;font-size:inherit;padding:0;} .perm-col-toggle:hover{color:var(--gold);}</style>';

      // Column bulk toggles (all / none per role)
      body.querySelectorAll('.perm-col-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var col = btn.getAttribute('data-col');
          var on = btn.getAttribute('data-all') === '1';
          body.querySelectorAll('input[data-role="' + col + '"]').forEach(function (cb) { cb.checked = on; });
        });
      });

      document.getElementById('perm-reset').addEventListener('click', function () {
        body.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          var r = cb.getAttribute('data-role');
          var a = cb.getAttribute('data-action');
          cb.checked = !!(DEFAULTS[r] && DEFAULTS[r][a]);
        });
        HM.ui.toast('Restored defaults (not saved yet — click Save Changes)', 'info');
      });

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
