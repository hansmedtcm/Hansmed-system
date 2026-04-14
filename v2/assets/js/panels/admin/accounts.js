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
          '<td data-label="Actions"><button class="btn btn--outline btn--sm" data-id="' + u.id + '">' + (u.status === 'active' ? 'Suspend' : 'Activate') + '</button></td>';
        tr.querySelector('button').addEventListener('click', async function () {
          try { await HM.api.admin.toggleAccount(u.id); HM.ui.toast('Account updated', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message, 'danger'); }
        });
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

  HM.adminPanels.accounts = { render: render };
})();
