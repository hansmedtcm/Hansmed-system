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
        '<strong>⚠️ Role defaults take effect immediately for all users of that role.</strong> ' +
        'Use the <em>Per-user overrides</em> section below to grant or revoke permissions for individual accounts (e.g. give Doctor A finance access but not Doctor B). ' +
        '<span style="font-family: var(--font-zh);">角色預設對整個角色生效。如需對個別帳號單獨調整，請使用下方「個別使用者覆寫」區塊。</span>' +
        '</div>' +
        '<div class="card"><div class="table-wrap"><table class="table">' + header + rows + '</table></div>' +
        '<div class="flex-between mt-4" style="flex-wrap:wrap;gap:var(--s-2);">' +
        '<div class="text-sm text-muted">' + ACTIONS.length + ' actions × ' + ROLES.length + ' roles · ' + GROUPS.length + ' groups</div>' +
        '<div class="flex gap-2">' +
          '<button class="btn btn--ghost" id="perm-reset">↺ Restore Defaults</button>' +
          '<button class="btn btn--primary" id="save-perms">💾 Save Role Defaults</button>' +
        '</div></div></div>' +

        /* ═══════ Per-user overrides section ═══════ */
        '<div class="card mt-6" id="user-override-card">' +
          '<h2 class="section-title" style="margin-bottom: var(--s-2);">Per-user overrides · 個別使用者覆寫</h2>' +
          '<p class="text-muted mb-3">Grant or revoke a specific permission on a specific account. Overrides win over the role default.' +
          ' <span style="font-family: var(--font-zh);">為個別帳號開啟或關閉某項權限。覆寫優先於角色預設。</span></p>' +
          '<div class="flex gap-2 mb-3" style="flex-wrap:wrap;align-items:end;">' +
            '<div style="flex:1;min-width:220px;">' +
              '<label class="field-label">Role · 角色</label>' +
              '<select id="uo-role" class="field-input">' +
                '<option value="doctor">Doctor · 醫師</option>' +
                '<option value="admin">Admin · 管理員</option>' +
                '<option value="pharmacy">Pharmacy · 藥房</option>' +
              '</select>' +
            '</div>' +
            '<div style="flex:2;min-width:260px;">' +
              '<label class="field-label">User · 使用者</label>' +
              '<select id="uo-user" class="field-input"><option value="">— Select account —</option></select>' +
            '</div>' +
            '<button class="btn btn--ghost" id="uo-migrate" title="Create the user_permission_overrides table on older deployments">🔧 Run migration</button>' +
          '</div>' +
          '<div id="uo-body"><div class="text-muted text-sm">Select a user above to load their permissions.</div></div>' +
        '</div>' +

        '<style>' +
          '.perm-col-toggle{background:none;border:none;color:var(--stone);cursor:pointer;text-decoration:underline;font-size:inherit;padding:0;}' +
          '.perm-col-toggle:hover{color:var(--gold);}' +
          '.uo-row{display:grid;grid-template-columns:2fr 1fr;gap:var(--s-3);align-items:center;padding:var(--s-2) 0;border-bottom:1px solid var(--border);}' +
          '.uo-tri{display:inline-flex;border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;}' +
          '.uo-tri button{background:transparent;border:0;padding:6px 12px;font-size:var(--text-xs);cursor:pointer;color:var(--stone);font-family:inherit;}' +
          '.uo-tri button:hover{background:var(--washi);color:var(--ink);}' +
          '.uo-tri button.is-default{background:var(--mist);color:var(--ink);}' +
          '.uo-tri button.is-allow{background:var(--sage);color:white;}' +
          '.uo-tri button.is-deny{background:var(--red-seal);color:white;}' +
          '.uo-key{font-family:var(--font-mono);font-size:var(--text-xs);color:var(--stone);display:block;margin-top:2px;}' +
        '</style>';

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
        body.querySelectorAll('#pm-body > .card:first-of-type input[type="checkbox"]').forEach(function (cb) {
          var r = cb.getAttribute('data-role');
          var a = cb.getAttribute('data-action');
          data[r][a] = cb.checked;
        });
        try {
          await HM.api.admin.setPermissions(data);
          HM.ui.toast('Role defaults saved · 角色預設已保存', 'success');
        } catch (e) { HM.ui.toast(e.message, 'danger'); }
        finally { btn.disabled = false; }
      });

      /* ═══════ Per-user overrides wiring ═══════ */
      wireUserOverrides();
    } catch (e) { HM.state.error(body, e); }
  }

  /**
   * Wire up the per-user override section: role dropdown filters the user
   * picker, picking a user loads their effective permissions + overrides,
   * each permission row is a tri-state (default / allow / deny) control,
   * Save persists to /admin/users/{id}/permissions.
   */
  async function wireUserOverrides() {
    var roleSel = document.getElementById('uo-role');
    var userSel = document.getElementById('uo-user');
    var uoBody  = document.getElementById('uo-body');
    var migrateBtn = document.getElementById('uo-migrate');

    /* Cache of account rows by role so we don't refetch on every role change. */
    var usersByRole = {};

    async function loadUsers(role) {
      if (usersByRole[role]) return usersByRole[role];
      try {
        var res = await HM.api.admin.listAccounts('role=' + encodeURIComponent(role));
        var list = (res.accounts || res || []).filter(function (u) { return u.role === role; });
        usersByRole[role] = list;
        return list;
      } catch (e) {
        /* Fallback: some deployments use /admin/doctors for doctor list */
        if (role === 'doctor') {
          try {
            var d = await HM.api.admin.listDoctors();
            var list2 = (d.doctors || d || []).map(function (x) {
              return { id: x.user_id || x.id, email: x.email, name: x.name, role: 'doctor' };
            });
            usersByRole[role] = list2;
            return list2;
          } catch (_) {}
        }
        return [];
      }
    }

    async function refreshUserList() {
      var role = roleSel.value;
      userSel.innerHTML = '<option value="">— Loading —</option>';
      var list = await loadUsers(role);
      userSel.innerHTML = '<option value="">— Select account —</option>' +
        list.map(function (u) {
          var label = (u.name || '') + (u.email ? ' (' + u.email + ')' : ('#' + u.id));
          return '<option value="' + u.id + '">' + HM.format.esc(label.trim() || ('User #' + u.id)) + '</option>';
        }).join('');
      uoBody.innerHTML = '<div class="text-muted text-sm">Select a user above to load their permissions.</div>';
    }

    async function loadUserPerms(userId) {
      HM.state.loading(uoBody);
      try {
        var data = await HM.api.admin.getUserPermissions(userId);
        renderUserPerms(userId, data);
      } catch (e) {
        uoBody.innerHTML = '<div class="alert alert--danger">Failed to load: ' + HM.format.esc(e.message || '') +
          '<div class="text-xs mt-2">If this is the first time, click "🔧 Run migration" above to create the override table.</div></div>';
      }
    }

    function renderUserPerms(userId, data) {
      var defaults  = data.role_defaults || {};
      var overrides = data.overrides || {};
      var allKeys   = data.all_keys || Object.keys(defaults);
      if (!allKeys.length) {
        uoBody.innerHTML = '<div class="alert alert--warning">No permission keys are defined for this role yet. Save role defaults first.</div>';
        return;
      }

      var rows = allKeys.map(function (key) {
        var hasOverride = Object.prototype.hasOwnProperty.call(overrides, key);
        var state = hasOverride ? (overrides[key] ? 'allow' : 'deny') : 'default';
        var defaultVal = !!defaults[key];
        var defaultLabel = defaultVal ? 'ALLOW' : 'DENY';
        var prettyKey = key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        return '<div class="uo-row" data-key="' + key + '">' +
          '<div><strong>' + HM.format.esc(prettyKey) + '</strong>' +
          '<code class="uo-key">' + key + ' · role default: ' + defaultLabel + '</code></div>' +
          '<div class="uo-tri" data-state="' + state + '">' +
            '<button type="button" data-v="default" class="' + (state === 'default' ? 'is-default' : '') + '">Default</button>' +
            '<button type="button" data-v="allow"   class="' + (state === 'allow'   ? 'is-allow'   : '') + '">Allow</button>' +
            '<button type="button" data-v="deny"    class="' + (state === 'deny'    ? 'is-deny'    : '') + '">Deny</button>' +
          '</div>' +
        '</div>';
      }).join('');

      uoBody.innerHTML = rows +
        '<div class="flex-between mt-4" style="flex-wrap:wrap;gap:var(--s-2);">' +
          '<div class="text-sm text-muted">' + allKeys.length + ' permission keys · changes apply immediately on save</div>' +
          '<button class="btn btn--primary" id="uo-save">💾 Save Overrides</button>' +
        '</div>';

      /* Tri-state pill click handler */
      uoBody.querySelectorAll('.uo-tri').forEach(function (tri) {
        tri.addEventListener('click', function (ev) {
          var btn = ev.target.closest('button[data-v]');
          if (!btn) return;
          var v = btn.getAttribute('data-v');
          tri.setAttribute('data-state', v);
          tri.querySelectorAll('button').forEach(function (b) {
            b.classList.remove('is-default', 'is-allow', 'is-deny');
          });
          btn.classList.add('is-' + v);
        });
      });

      /* Save handler — collect all non-default pills */
      document.getElementById('uo-save').addEventListener('click', async function () {
        var btn = this;
        btn.disabled = true;
        var overrides = {};
        uoBody.querySelectorAll('.uo-row').forEach(function (row) {
          var key = row.getAttribute('data-key');
          var state = row.querySelector('.uo-tri').getAttribute('data-state');
          if (state === 'allow')     overrides[key] = true;
          else if (state === 'deny') overrides[key] = false;
          else                       overrides[key] = null; /* revert to role default — deletes row */
        });
        try {
          await HM.api.admin.setUserPermissions(userId, overrides);
          HM.ui.toast('User permissions saved · 個別權限已保存', 'success');
        } catch (e) { HM.ui.toast(e.message || 'Save failed', 'danger'); }
        finally { btn.disabled = false; }
      });
    }

    /* Hook role dropdown */
    roleSel.addEventListener('change', refreshUserList);
    userSel.addEventListener('change', function () {
      var uid = userSel.value;
      if (!uid) {
        uoBody.innerHTML = '<div class="text-muted text-sm">Select a user above to load their permissions.</div>';
        return;
      }
      loadUserPerms(uid);
    });
    migrateBtn.addEventListener('click', async function () {
      var btn = this;
      btn.disabled = true;
      try {
        await HM.api.admin.migrateUserPermissions();
        HM.ui.toast('Migration applied — per-user overrides ready', 'success');
      } catch (e) { HM.ui.toast(e.message || 'Migration failed', 'danger'); }
      finally { btn.disabled = false; }
    });

    /* Initial user list */
    refreshUserList();
  }

  HM.adminPanels.permissions = { render: render };
})();
