/**
 * Admin Accounts — unified create-any-role form + list
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var filter = '';

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Accounts · 帳號管理</div>' +
      '<h1 class="page-title">Staff Accounts</h1></div>' +
      '<button class="btn btn--primary" id="new-account">+ Create Account</button></div>' +
      '<div class="filter-bar">' +
      chip('', 'All') + chip('doctor', 'Doctors') + chip('pharmacy', 'Pharmacies') + chip('admin', 'Admins') +
      '</div><div id="acc-list"></div>';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        filter = c.getAttribute('data-filter');
        load();
      });
    });
    document.getElementById('new-account').addEventListener('click', showCreateForm);
    await load();
  }

  function chip(f, l) { return '<button class="filter-chip ' + (f === filter ? 'is-active' : '') + '" data-filter="' + f + '">' + l + '</button>'; }

  async function load() {
    var container = document.getElementById('acc-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listAccounts(filter ? 'role=' + filter : '');
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '👥', title: 'No accounts', text: 'Create staff accounts to get started' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (u) {
        var dp = u.doctor_profile || {};
        var ph = u.pharmacy_profile || {};
        var name = dp.full_name || ph.name || u.email;
        var roleColor = { doctor: 'badge--success', pharmacy: 'badge--active', admin: 'badge--danger' };
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Name">' + HM.format.esc(name) + '</td>' +
          '<td data-label="Email">' + HM.format.esc(u.email) + '</td>' +
          '<td data-label="Role"><span class="badge ' + (roleColor[u.role] || '') + '">' + u.role + '</span></td>' +
          '<td data-label="Status">' + HM.format.statusBadge(u.status) + '</td>' +
          '<td data-label="Actions" style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn--sm" data-act="edit">✎ Edit</button> ' +
            '<button class="btn btn--ghost btn--sm" data-act="pw">🔑 Password</button> ' +
            '<button class="btn btn--outline btn--sm" data-act="toggle">' + (u.status === 'active' ? 'Suspend' : 'Activate') + '</button>' +
          '</td>';
        tr.querySelector('[data-act="toggle"]').addEventListener('click', async function () {
          try { await HM.api.admin.toggleAccount(u.id); HM.ui.toast('Account updated', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message, 'danger'); }
        });
        tr.querySelector('[data-act="pw"]').addEventListener('click', function () { showResetPassword(u); });
        tr.querySelector('[data-act="edit"]').addEventListener('click', function () { showEditForm(u); });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  function showCreateForm() {
    var m = HM.ui.modal({
      size: 'lg',
      title: 'Create New Account · 新增帳號',
      content: '<form id="ca-form">' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label" data-required>Role · 角色</label>' +
        '<select name="role" class="field-input field-input--boxed" required id="ca-role">' +
        '<option value="doctor">Doctor · 醫師</option>' +
        '<option value="pharmacy">Pharmacy · 藥房</option>' +
        '<option value="admin">Admin · 管理員</option>' +
        '</select></div>' +
        '<div class="field"><label class="field-label" data-required>Name · 名稱</label><input name="name" class="field-input field-input--boxed" required></div>' +
        '<div class="field"><label class="field-label" data-required>Email · 電郵</label><input type="email" name="email" class="field-input field-input--boxed" required></div>' +
        '<div class="field"><label class="field-label" data-required>Password · 密碼</label><input type="password" name="password" class="field-input field-input--boxed" required minlength="8"></div>' +
        '</div>' +

        '<div id="ca-doctor-fields">' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Specialties · 專長</label><input name="specialties" class="field-input field-input--boxed" placeholder="e.g. General TCM, Gynecology"></div>' +
        '<div class="field"><label class="field-label">Consultation Fee (RM)</label><input name="consultation_fee" type="number" class="field-input field-input--boxed" value="120"></div>' +
        '<div class="field" style="grid-column: span 2;"><label class="field-label">License No · 執照</label><input name="license_no" class="field-input field-input--boxed"></div>' +
        '</div></div>' +

        '<div id="ca-pharmacy-fields" style="display:none;">' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Address · 地址</label><input name="address_line" class="field-input field-input--boxed"></div>' +
        '<div class="field"><label class="field-label">City · 城市</label><input name="city" class="field-input field-input--boxed"></div>' +
        '<div class="field"><label class="field-label">State · 州</label><input name="state" class="field-input field-input--boxed"></div>' +
        '<div class="field"><label class="field-label">Phone · 電話</label><input name="phone" class="field-input field-input--boxed"></div>' +
        '</div></div>' +

        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary btn--block mt-4">Create Account</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#ca-form');
    m.element.querySelector('#ca-role').addEventListener('change', function (e) {
      m.element.querySelector('#ca-doctor-fields').style.display = e.target.value === 'doctor' ? 'block' : 'none';
      m.element.querySelector('#ca-pharmacy-fields').style.display = e.target.value === 'pharmacy' ? 'block' : 'none';
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      HM.form.setLoading(form, true);
      try {
        await HM.api.admin.createAccount(d);
        m.close();
        HM.ui.toast('Account created · 帳號已建立', 'success');
        load();
      } catch (err) {
        HM.form.setLoading(form, false);
        if (err.data && err.data.errors) HM.form.showErrors(form, err.data.errors);
        else HM.form.showGeneralError(form, err.message || 'Failed');
      }
    });
  }

  /**
   * Reset-password modal. Works for any role (patient, doctor, pharmacy,
   * admin) since the backend endpoint accepts any user id. Exposed on the
   * panel so the patients panel can reuse it with a single call.
   */
  function showResetPassword(user) {
    var label = (user.role || '').toUpperCase();
    var displayName = (user.doctor_profile && user.doctor_profile.full_name)
      || (user.pharmacy_profile && user.pharmacy_profile.name)
      || (user.patient_profile && user.patient_profile.nickname)
      || user.email;

    var m = HM.ui.modal({
      size: 'md',
      title: '🔑 Reset Password · 重設密碼',
      content:
        '<div class="alert alert--warning mb-3"><div class="alert-body">' +
        'Setting a new password for <strong>' + HM.format.esc(displayName) + '</strong> ' +
        '<span class="text-muted">(' + HM.format.esc(user.email) + ' · ' + label + ')</span>. ' +
        'The user\'s existing sessions will be signed out immediately. ' +
        '<span style="font-family: var(--font-zh);">此操作將立即登出該使用者所有工作階段。</span>' +
        '</div></div>' +
        '<form id="rpw-form">' +
        '<div class="field"><label class="field-label" data-required>New Password · 新密碼</label>' +
        '<input type="text" name="password" class="field-input field-input--boxed" required minlength="8" autocomplete="new-password"></div>' +
        '<div class="text-xs text-muted mb-3">Minimum 8 characters. Share the new password with the user via a secure channel (e.g. WhatsApp, encrypted email).</div>' +
        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary btn--block">Set New Password</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#rpw-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      if (!d.password || d.password.length < 8) {
        HM.form.showGeneralError(form, 'Password must be at least 8 characters');
        return;
      }
      HM.form.setLoading(form, true);
      try {
        await HM.api.admin.resetAccountPassword(user.id, d.password);
        m.close();
        HM.ui.toast('Password reset for ' + user.email, 'success', 5000);
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, (err && err.message) || 'Failed');
      }
    });
  }

  /** Edit-account modal. Covers email + status + role-specific fields. */
  function showEditForm(user) {
    var dp = user.doctor_profile || {};
    var ph = user.pharmacy_profile || {};
    var pt = user.patient_profile || {};
    var isDoc  = user.role === 'doctor';
    var isPha  = user.role === 'pharmacy';
    var isPat  = user.role === 'patient';
    var currentName = dp.full_name || ph.name || pt.nickname || '';

    var roleSpecific = '';
    if (isDoc) {
      roleSpecific =
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Specialties · 專長</label>' +
        '<input name="specialties" class="field-input field-input--boxed" value="' + HM.format.esc(dp.specialties || '') + '"></div>' +
        '<div class="field"><label class="field-label">Consultation Fee (RM)</label>' +
        '<input name="consultation_fee" type="number" class="field-input field-input--boxed" value="' + HM.format.esc(dp.consultation_fee || '') + '"></div>' +
        '<div class="field" style="grid-column: span 2;"><label class="field-label">License No · 執照</label>' +
        '<input name="license_no" class="field-input field-input--boxed" value="' + HM.format.esc(dp.license_no || '') + '"></div>' +
        '<div class="field" style="grid-column: span 2;"><label class="field-label">Bio · 簡介</label>' +
        '<textarea name="bio" class="field-input field-input--boxed" rows="3">' + HM.format.esc(dp.bio || '') + '</textarea></div>' +
        '</div>';
    } else if (isPha) {
      roleSpecific =
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">License No · 執照</label>' +
        '<input name="license_no" class="field-input field-input--boxed" value="' + HM.format.esc(ph.license_no || '') + '"></div>' +
        '<div class="field"><label class="field-label">Phone · 電話</label>' +
        '<input name="phone" class="field-input field-input--boxed" value="' + HM.format.esc(ph.phone || '') + '"></div>' +
        '<div class="field" style="grid-column: span 2;"><label class="field-label">Address · 地址</label>' +
        '<input name="address_line" class="field-input field-input--boxed" value="' + HM.format.esc(ph.address_line || '') + '"></div>' +
        '<div class="field"><label class="field-label">City · 城市</label>' +
        '<input name="city" class="field-input field-input--boxed" value="' + HM.format.esc(ph.city || '') + '"></div>' +
        '<div class="field"><label class="field-label">State · 州</label>' +
        '<input name="state" class="field-input field-input--boxed" value="' + HM.format.esc(ph.state || '') + '"></div>' +
        '</div>';
    } else if (isPat) {
      roleSpecific =
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Gender · 性別</label>' +
        '<select name="gender" class="field-input field-input--boxed">' +
        ['', 'male', 'female', 'other'].map(function (g) {
          return '<option value="' + g + '"' + (pt.gender === g ? ' selected' : '') + '>' + (g || '—') + '</option>';
        }).join('') +
        '</select></div>' +
        '<div class="field"><label class="field-label">Birth Date · 出生日期</label>' +
        '<input type="date" name="birth_date" class="field-input field-input--boxed" value="' + HM.format.esc(pt.birth_date || '') + '"></div>' +
        '<div class="field"><label class="field-label">Phone · 電話</label>' +
        '<input name="phone" class="field-input field-input--boxed" value="' + HM.format.esc(pt.phone || '') + '"></div>' +
        '</div>';
    }

    var m = HM.ui.modal({
      size: 'lg',
      title: '✎ Edit Account · 編輯帳號 <span class="text-muted" style="font-size:var(--text-sm);">· ' + (user.role || '') + '</span>',
      content:
        '<form id="ea-form">' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Name · 名稱</label>' +
        '<input name="name" class="field-input field-input--boxed" value="' + HM.format.esc(currentName) + '"></div>' +
        '<div class="field"><label class="field-label">Email · 電郵</label>' +
        '<input type="email" name="email" class="field-input field-input--boxed" value="' + HM.format.esc(user.email || '') + '"></div>' +
        '<div class="field"><label class="field-label">Status · 狀態</label>' +
        '<select name="status" class="field-input field-input--boxed">' +
        ['active', 'pending', 'suspended'].map(function (s) {
          return '<option value="' + s + '"' + (user.status === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
        '</select></div>' +
        '</div>' +

        (roleSpecific ? '<div class="mt-4"><div class="text-label mb-2">' + (user.role || '').toUpperCase() + ' details</div>' + roleSpecific + '</div>' : '') +

        '<div data-general-error class="alert alert--danger mt-3" style="display:none;"></div>' +
        '<div class="flex gap-2 mt-4">' +
        '<button type="button" class="btn btn--ghost" id="ea-reset-pw">🔑 Reset Password</button>' +
        '<button type="submit" class="btn btn--primary" style="margin-left:auto;">Save Changes</button>' +
        '</div>' +
        '</form>',
    });

    var form = m.element.querySelector('#ea-form');
    m.element.querySelector('#ea-reset-pw').addEventListener('click', function () {
      m.close();
      showResetPassword(user);
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      HM.form.setLoading(form, true);
      try {
        await HM.api.admin.updateAccount(user.id, d);
        m.close();
        HM.ui.toast('Account updated', 'success');
        load();
      } catch (err) {
        HM.form.setLoading(form, false);
        if (err.data && err.data.errors) HM.form.showErrors(form, err.data.errors);
        else HM.form.showGeneralError(form, (err && err.message) || 'Failed');
      }
    });
  }

  HM.adminPanels.accounts = {
    render: render,
    // Exposed so other admin panels (e.g. patients) can reuse the modals
    // without duplicating the form markup.
    showResetPassword: showResetPassword,
    showEditForm: showEditForm,
  };
})();
