/**
 * HansMed Registration Wall
 * --------------------------
 * Forces patients to complete their full registration before accessing the platform.
 * After completion, profile becomes read-only (only admin can edit).
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Check registration status after login ──
  var _origLoginSuccess = window.loginSuccess;
  window.loginSuccess = function (user) {
    if (typeof _origLoginSuccess === 'function') _origLoginSuccess(user);
    if (user.role === 'patient') {
      checkRegistrationStatus();
    }
  };

  async function checkRegistrationStatus() {
    try {
      var res = await A.patient.getProfile();
      var user = res.user || res;
      var pp = user.patient_profile || {};
      if (!pp.registration_completed) {
        showRegistrationWall(pp);
      }
    } catch {}
  }

  // ── Intercept API 403 with registration_incomplete ──
  var _origFetch = window.fetch;
  window.fetch = function () {
    return _origFetch.apply(this, arguments).then(function (res) {
      if (res.status === 403) {
        var cloned = res.clone();
        cloned.json().then(function (data) {
          if (data && data.registration_incomplete) {
            showRegistrationWall({});
          }
        }).catch(function () {});
      }
      return res;
    });
  };

  // ── Registration Wall UI ──
  function showRegistrationWall(existingData) {
    if (document.getElementById('reg-wall-modal')) return;

    var p = existingData || {};
    var html = ''
      + '<div id="reg-wall-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:var(--cream);overflow-y:auto;padding:2rem;">'
      + '<div style="max-width:700px;margin:0 auto;">'
      + '  <div style="text-align:center;margin-bottom:2rem;">'
      + '    <div style="font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem;">Registration · 註冊</div>'
      + '    <h2 style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;animation:none;opacity:1;">Complete Your Profile</h2>'
      + '    <p style="color:var(--stone);font-size:.92rem;margin-top:.5rem;">Please fill in all required fields to continue. · 請填寫所有必填資料以繼續。</p>'
      + '    <p style="color:var(--red-seal);font-size:.78rem;margin-top:.3rem;">⚠ Once submitted, your profile cannot be edited. Please double-check all information. · 提交後資料將無法自行修改。</p>'
      + '  </div>'

      + regSection('Personal Information · 個人資料')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:1.5rem;">'
      + regField('rw-fullname', 'Full Name · 姓名 *', p.full_name || '', 'text')
      + regField('rw-ic', 'IC / ID Number · 身份證號碼 *', p.ic_number || '', 'text')
      + regField('rw-phone', 'Phone · 電話 *', p.phone || '', 'tel')
      + regField('rw-dob', 'Date of Birth · 出生日期 *', p.birth_date ? String(p.birth_date).substring(0,10) : '', 'date')
      + regSelect('rw-gender', 'Gender · 性別 *', p.gender || '', [
          {v:'',l:'Select · 請選擇'},{v:'male',l:'Male · 男'},{v:'female',l:'Female · 女'},{v:'other',l:'Other · 其他'}
        ])
      + regField('rw-occupation', 'Occupation · 職業', p.occupation || '', 'text')
      + '</div>'

      + regSection('Address · 地址')
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:1.5rem;">'
      + regField('rw-addr1', 'Address Line 1 · 地址 *', p.address_line1 || '', 'text')
      + regField('rw-addr2', 'Address Line 2 · 地址2', p.address_line2 || '', 'text')
      + regField('rw-city', 'City · 城市 *', p.city || '', 'text')
      + regField('rw-state', 'State · 州 *', p.state || '', 'text')
      + regField('rw-postal', 'Postal Code · 郵遞區號 *', p.postal_code || '', 'text')
      + regField('rw-country', 'Country · 國家 *', p.country || 'Malaysia', 'text')
      + '</div>'

      + regSection('Emergency Contact · 緊急聯絡人')
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.2rem;margin-bottom:1.5rem;">'
      + regField('rw-emname', 'Contact Name · 姓名 *', p.emergency_contact_name || '', 'text')
      + regField('rw-emphone', 'Contact Phone · 電話 *', p.emergency_contact_phone || '', 'tel')
      + regField('rw-emrel', 'Relationship · 關係 *', p.emergency_contact_relation || '', 'text')
      + '</div>'

      + regSection('Medical Information · 醫療資訊')
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.2rem;margin-bottom:1rem;">'
      + regSelect('rw-blood', 'Blood Type · 血型 *', p.blood_type || '', [
          {v:'',l:'Select · 請選擇'},{v:'A+',l:'A+'},{v:'A-',l:'A-'},{v:'B+',l:'B+'},{v:'B-',l:'B-'},
          {v:'AB+',l:'AB+'},{v:'AB-',l:'AB-'},{v:'O+',l:'O+'},{v:'O-',l:'O-'},{v:'unknown',l:'Unknown · 不明'}
        ])
      + regField('rw-height', 'Height (cm) · 身高', p.height_cm || '', 'number')
      + regField('rw-weight', 'Weight (kg) · 體重', p.weight_kg || '', 'number')
      + '</div>'
      + regArea('rw-allergies', 'Allergies · 過敏史 *', p.allergies || '', 'Enter "None" if no allergies · 無過敏請填「None」')
      + regArea('rw-medhist', 'Medical History · 病史', p.medical_history || '', 'Past illnesses, surgeries · 過去病史、手術')
      + regArea('rw-meds', 'Current Medications · 現用藥物', p.current_medications || '', 'Currently taking · 目前服用的藥物')
      + regArea('rw-famhist', 'Family History · 家族病史', p.family_history || '', 'Family medical conditions · 家族病史')

      + '<div id="rw-error" style="color:var(--red-seal);font-size:.85rem;margin:1rem 0;"></div>'
      + '<button class="btn-primary" style="width:100%;padding:1rem;font-size:.9rem;" onclick="submitRegistrationWall()">Submit Registration · 提交註冊</button>'
      + '<p style="text-align:center;color:var(--stone);font-size:.72rem;margin-top:1rem;">Fields marked with * are required · 標記 * 為必填</p>'
      + '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function regSection(title) {
    return '<div style="font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:1.5rem 0 .6rem;border-bottom:1px solid var(--mist);padding-bottom:.4rem;">' + title + '</div>';
  }
  function regField(id, label, value, type) {
    return '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<input id="' + id + '" type="' + type + '" value="' + esc(value) + '" style="width:100%;padding:.6rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.9rem;"></div>';
  }
  function regSelect(id, label, value, options) {
    var h = '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<select id="' + id + '" style="width:100%;padding:.6rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.9rem;">';
    options.forEach(function (o) { h += '<option value="' + o.v + '"' + (o.v === value ? ' selected' : '') + '>' + o.l + '</option>'; });
    return h + '</select></div>';
  }
  function regArea(id, label, value, placeholder) {
    return '<div style="margin-bottom:.8rem;"><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<textarea id="' + id + '" rows="2" placeholder="' + placeholder + '" style="width:100%;padding:.6rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.85rem;resize:vertical;">' + esc(value) + '</textarea></div>';
  }
  function esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function gv(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  window.submitRegistrationWall = async function () {
    var errEl = document.getElementById('rw-error');
    errEl.textContent = '';

    var data = {
      full_name:       gv('rw-fullname'),
      phone:           gv('rw-phone'),
      ic_number:       gv('rw-ic'),
      gender:          gv('rw-gender'),
      birth_date:      gv('rw-dob'),
      occupation:      gv('rw-occupation'),
      address_line1:   gv('rw-addr1'),
      address_line2:   gv('rw-addr2'),
      city:            gv('rw-city'),
      state:           gv('rw-state'),
      postal_code:     gv('rw-postal'),
      country:         gv('rw-country'),
      emergency_contact_name:     gv('rw-emname'),
      emergency_contact_phone:    gv('rw-emphone'),
      emergency_contact_relation: gv('rw-emrel'),
      blood_type:          gv('rw-blood'),
      allergies:           gv('rw-allergies'),
      medical_history:     gv('rw-medhist'),
      current_medications: gv('rw-meds'),
      family_history:      gv('rw-famhist'),
      height_cm:           gv('rw-height') || null,
      weight_kg:           gv('rw-weight') || null,
    };

    // Client-side validation
    var required = ['full_name','phone','ic_number','gender','birth_date','address_line1','city','state','postal_code','country','emergency_contact_name','emergency_contact_phone','emergency_contact_relation','blood_type','allergies'];
    for (var i = 0; i < required.length; i++) {
      if (!data[required[i]]) {
        errEl.textContent = 'Please fill in all required fields (*). · 請填寫所有必填欄位。';
        document.getElementById('rw-' + required[i].replace('full_name','fullname').replace('ic_number','ic').replace('birth_date','dob').replace('address_line1','addr1').replace('postal_code','postal').replace('emergency_contact_name','emname').replace('emergency_contact_phone','emphone').replace('emergency_contact_relation','emrel').replace('blood_type','blood'))?.focus();
        return;
      }
    }

    try {
      await A.api.post('/patient/profile/complete-registration', data);
      // Remove wall
      var wall = document.getElementById('reg-wall-modal');
      if (wall) wall.remove();
      showToast('Registration completed! Welcome! · 註冊完成！歡迎！ ✓');
      // Refresh user data
      A.authMe();
    } catch (e) {
      var msg = '';
      if (e.data && e.data.errors) {
        var keys = Object.keys(e.data.errors);
        msg = keys.map(function (k) { return e.data.errors[k][0]; }).join('\n');
      }
      errEl.textContent = msg || e.message || 'Submission failed · 提交失敗';
    }
  };

  // ── Also check on page load (session restore) ──
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var user = A.getUser();
      if (user && user.role === 'patient' && A.getToken()) {
        checkRegistrationStatus();
      }
    }, 1500); // wait for session restore
  });

  console.log('[HansMed] Registration wall loaded');
})();
