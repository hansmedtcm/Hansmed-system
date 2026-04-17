/**
 * Admin Patients — list + edit (only place locked profiles can be edited)
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Patients · 患者管理</div>' +
      '<h1 class="page-title">All Patients</h1>' +
      '</div>' +
      '<input id="pt-search" type="text" class="field-input field-input--boxed mb-4" placeholder="Search by name, IC, phone… · 搜尋" style="max-width: 400px;">' +
      '<div id="pt-list"></div>';
    document.getElementById('pt-search').addEventListener('input', debounce(load, 300));
    await load();
  }

  async function load() {
    var container = document.getElementById('pt-list');
    var search = document.getElementById('pt-search') ? document.getElementById('pt-search').value : '';
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listPatients(search ? 'search=' + encodeURIComponent(search) : '');
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '🧑', title: 'No patients', text: 'Registered patients will appear here' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Name</th><th>Email</th><th>IC</th><th>Phone</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (u) {
        var p = u.patient_profile || {};
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Name">' + HM.format.esc(p.full_name || p.nickname || '—') + '</td>' +
          '<td data-label="Email">' + HM.format.esc(u.email) + '</td>' +
          '<td data-label="IC">' + HM.format.esc(p.ic_number || '—') + '</td>' +
          '<td data-label="Phone">' + HM.format.esc(p.phone || '—') + '</td>' +
          '<td data-label="Status">' + HM.format.statusBadge(u.status) + '</td>' +
          '<td data-label="Actions" style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn--sm" data-act="pw">🔑 Password</button> ' +
            '<button class="btn btn--outline btn--sm" data-act="view">View · 查看</button>' +
          '</td>';
        tr.querySelector('[data-act="view"]').addEventListener('click', function () { location.hash = '#/patients/' + u.id; });
        tr.querySelector('[data-act="pw"]').addEventListener('click', function () {
          // Reuse the accounts-panel reset modal — same backend endpoint works for every role.
          HM.adminPanels.accounts.showResetPassword(u);
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var res = await HM.api.admin.getPatient(id);
      var user = res.user;
      var p = user.patient_profile || {};

      el.innerHTML = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/patients\'">← Back</button>' +
        '<div class="flex-between" style="align-items:center;flex-wrap:wrap;gap:var(--s-2);">' +
        '<h1 class="page-title mt-2">' + HM.format.esc(p.full_name || user.email) + '</h1>' +
        '<button class="btn btn--ghost" id="pt-reset-pw">🔑 Reset Password · 重設密碼</button>' +
        '</div>' +
        '</div>' +
        '<form id="pt-form" class="card card--pad-lg" style="max-width: 900px;">' +
        '<div class="alert alert--warning"><div class="alert-body">You are editing a locked patient profile. Changes are logged to audit.</div></div>' +
        '<div class="field-grid field-grid--2">' +
        fld('full_name', 'Full Name', p.full_name) +
        fld('ic_number', 'IC Number', p.ic_number) +
        fld('phone', 'Phone', p.phone) +
        fld('birth_date', 'Birth Date', p.birth_date ? p.birth_date.substring(0, 10) : '', 'date') +
        sel('gender', 'Gender', p.gender, [['','—'],['male','Male'],['female','Female'],['other','Other']]) +
        fld('blood_type', 'Blood Type', p.blood_type) +
        fld('city', 'City', p.city) +
        fld('state', 'State', p.state) +
        '</div>' +
        '<div class="field"><label class="field-label">Address</label><input name="address_line1" class="field-input" value="' + HM.format.esc(p.address_line1 || '') + '"></div>' +
        '<div class="field"><label class="field-label">Allergies</label><textarea name="allergies" class="field-input" rows="2">' + HM.format.esc(p.allergies || '') + '</textarea></div>' +
        '<div class="field"><label class="field-label">Medical History</label><textarea name="medical_history" class="field-input" rows="2">' + HM.format.esc(p.medical_history || '') + '</textarea></div>' +
        '<div class="field"><label class="field-label">Current Medications</label><textarea name="current_medications" class="field-input" rows="2">' + HM.format.esc(p.current_medications || '') + '</textarea></div>' +
        '<button type="submit" class="btn btn--primary">Save Changes</button>' +
        '</form>';

      var pwBtn = document.getElementById('pt-reset-pw');
      if (pwBtn) pwBtn.addEventListener('click', function () {
        HM.adminPanels.accounts.showResetPassword(user);
      });

      document.getElementById('pt-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var d = HM.form.serialize(e.target);
        HM.form.setLoading(e.target, true);
        try {
          await HM.api.admin.updatePatient(id, d);
          HM.ui.toast('Patient updated · 已更新', 'success');
          HM.form.setLoading(e.target, false);
        } catch (err) {
          HM.form.setLoading(e.target, false);
          HM.ui.toast(err.message || 'Failed', 'danger');
        }
      });
    } catch (e) { HM.state.error(el, e); }
  }

  function fld(name, label, value, type) {
    return '<div class="field"><label class="field-label">' + label + '</label>' +
      '<input name="' + name + '" type="' + (type || 'text') + '" class="field-input" value="' + HM.format.esc(value || '') + '"></div>';
  }
  function sel(name, label, value, options) {
    return '<div class="field"><label class="field-label">' + label + '</label>' +
      '<select name="' + name + '" class="field-input field-input--boxed">' +
      options.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === value ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div>';
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  HM.adminPanels.patients = { render: render, renderDetail: renderDetail };
})();
