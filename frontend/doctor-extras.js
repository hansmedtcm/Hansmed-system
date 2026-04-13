/**
 * HansMed Doctor — D-02, D-05, D-06, D-10, D-14
 * ------------------------------------------------
 * Doctor profile, patient list, tongue reports, consultation records, help.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Inject extra tabs into doctor sidebar ──
  function injectDoctorTabs() {
    var nav = document.querySelector('#page-doctor .portal-sidebar, #page-doctor [class*="sidebar"]');
    if (!nav || document.getElementById('doc-profile-btn')) return;

    var tabs = [
      { id: 'doc-profile',     icon: '👤', label: 'My Profile · 個人資料',    fn: loadDocProfile },
      { id: 'doc-patients',    icon: '📋', label: 'Patient List · 患者列表',   fn: loadDocPatients },
      { id: 'doc-records',     icon: '📝', label: 'Consult Records · 問診記錄', fn: loadDocRecords },
      { id: 'doc-help',        icon: '❓', label: 'Help & Support · 幫助',     fn: loadDocHelp },
    ];

    tabs.forEach(function (t) {
      var btn = document.createElement('button');
      btn.id = t.id + '-btn';
      btn.className = 'portal-nav-item';
      btn.textContent = t.icon + ' ' + t.label;
      btn.onclick = function () {
        // Switch panel
        document.querySelectorAll('#page-doctor .portal-panel, #page-doctor .doc-panel').forEach(function (p) { p.classList.remove('active'); p.style.display = 'none'; });
        document.querySelectorAll('#page-doctor .portal-nav-item').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var panel = document.getElementById(t.id);
        if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }
        t.fn();
      };
      nav.appendChild(btn);

      // Create panel
      var panel = document.createElement('div');
      panel.id = t.id;
      panel.className = 'portal-panel doc-panel';
      panel.style.display = 'none';
      panel.innerHTML = '<div style="color:var(--stone);padding:2rem;">Loading...</div>';
      var content = document.querySelector('#page-doctor .portal-content');
      if (content) content.appendChild(panel);
    });
  }

  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'doctor') setTimeout(injectDoctorTabs, 200);
  };

  // ================================================================
  // D-02: DOCTOR PROFILE
  // ================================================================
  async function loadDocProfile() {
    var el = document.getElementById('doc-profile');
    if (!el) return;
    try {
      var res = await A.api.get('/doctor/profile');
      var user = res.user || {};
      var dp = user.doctor_profile || {};

      el.innerHTML = ''
        + '<h3>My Profile · 個人資料</h3>'
        + '<div class="sub-label">Manage your professional information · 管理您的專業資訊</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.3rem;margin:1.5rem 0;">'
        + field('dp-name', 'Full Name · 姓名', dp.full_name || '')
        + field('dp-email', 'Email · 電郵', user.email || '', true)
        + field('dp-spec', 'Specialties · 專長', dp.specialties || '')
        + field('dp-fee', 'Consultation Fee (RM) · 診費', dp.consultation_fee || '', 'number')
        + field('dp-license', 'License No · 執照號碼', dp.license_no || '')
        + '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">Accepting Appointments · 接受預約</label>'
        + '<select id="dp-accepting" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;">'
        + '<option value="1"' + (dp.accepting_appointments ? ' selected' : '') + '>Yes · 是</option>'
        + '<option value="0"' + (!dp.accepting_appointments ? ' selected' : '') + '>No · 否</option>'
        + '</select></div>'
        + '</div>'
        + '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">Bio · 簡介</label>'
        + '<textarea id="dp-bio" rows="4" style="width:100%;padding:.6rem;border:1px solid var(--mist);background:var(--washi);outline:none;resize:vertical;">' + esc(dp.bio || '') + '</textarea></div>'
        + '<button class="btn-primary" style="margin-top:1rem;" onclick="saveDocProfile()">Save Profile · 儲存 ✓</button>';
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load profile</p>'; }
  }

  window.saveDocProfile = async function () {
    try {
      await A.api.put('/doctor/profile', {
        full_name: gv('dp-name'),
        specialties: gv('dp-spec'),
        consultation_fee: parseFloat(gv('dp-fee')) || 0,
        license_no: gv('dp-license'),
        accepting_appointments: gv('dp-accepting') === '1',
        bio: gv('dp-bio'),
      });
      showToast('Profile saved! · 資料已儲存 ✓');
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // D-05: PATIENT LIST
  // ================================================================
  async function loadDocPatients(search) {
    var el = document.getElementById('doc-patients');
    if (!el) return;
    try {
      var params = search ? '?search=' + encodeURIComponent(search) : '';
      var res = await A.api.get('/doctor/patients' + params);
      var patients = res.data || [];

      el.innerHTML = ''
        + '<h3>My Patients · 我的患者</h3>'
        + '<div class="sub-label">All patients you have consulted · 您問診過的所有患者</div>'
        + '<input id="doc-pt-search" type="text" placeholder="Search by name, IC, phone... · 搜尋" style="width:100%;padding:.6rem;border:1px solid var(--mist);background:var(--washi);outline:none;margin:1rem 0;" oninput="searchDocPatients(this.value)">'
        + (patients.length ? patients.map(function (p) {
            var pp = p.patient_profile || {};
            var name = pp.full_name || pp.nickname || p.email;
            return '<div class="health-record-card" onclick="viewPatientDetail(' + p.id + ')" style="cursor:pointer;">'
              + '<div class="hrc-icon">👤</div>'
              + '<div><div class="hrc-title">' + name + '</div>'
              + '<div class="hrc-val">' + (pp.ic_number || '') + ' · ' + (pp.phone || '') + ' · ' + (p.appointment_count || 0) + ' visits'
              + (p.last_visit ? ' · Last: ' + formatDate(p.last_visit) : '') + '</div></div>'
              + '<div style="display:flex;gap:.4rem;">'
              + '<button class="ph-btn-outline" style="font-size:.65rem;" onclick="event.stopPropagation();viewPatientTongue(' + p.id + ')">👅 Tongue</button>'
              + '<button class="ph-btn-outline" style="font-size:.65rem;" onclick="event.stopPropagation();openChat(null,' + p.id + ')">💬 Chat</button>'
              + '</div></div>';
          }).join('') : '<p style="color:var(--stone);margin-top:1rem;">No patients yet. Your patients will appear here after their first consultation. · 暫無患者</p>');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load patients</p>'; }
  }

  window.searchDocPatients = function (val) {
    loadDocPatients(val);
  };

  // ── D-06: View patient tongue reports ──
  window.viewPatientTongue = async function (patientId) {
    try {
      var res = await A.api.get('/doctor/patients/' + patientId + '/tongue-diagnoses');
      var items = res.data || [];

      var html = '<h3>Patient Tongue Diagnosis History · 患者舌診記錄</h3>'
        + '<button class="btn-ghost" onclick="loadDocPatients()" style="margin-bottom:1rem;">← Back to patient list · 返回列表</button>';

      if (!items.length) {
        html += '<p style="color:var(--stone);">No tongue scans for this patient · 此患者暫無舌診記錄</p>';
      } else {
        html += items.map(function (d) {
          var report = d.constitution_report || {};
          var constitution = report.constitution || {};
          return '<div style="background:var(--washi);border:1px solid var(--mist);padding:1rem;margin-bottom:.8rem;border-left:3px solid var(--sage);">'
            + '<div style="display:flex;justify-content:space-between;">'
            + '<div><strong>' + formatDate(d.created_at) + '</strong></div>'
            + '<div style="font-size:.85rem;">Score: <strong>' + (d.health_score || '—') + '</strong>/100</div>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:.5rem;font-size:.82rem;color:var(--stone);">'
            + '<div>Color: ' + (d.tongue_color || '—').replace(/_/g, ' ') + '</div>'
            + '<div>Coating: ' + (d.coating || '—').replace(/_/g, ' ') + '</div>'
            + '<div>Shape: ' + (d.shape || '—').replace(/_/g, ' ') + '</div>'
            + '<div>Teeth marks: ' + (d.teeth_marks ? 'Yes' : 'No') + '</div>'
            + '<div>Cracks: ' + (d.cracks ? 'Yes' : 'No') + '</div>'
            + '<div>Moisture: ' + (d.moisture || '—') + '</div>'
            + '</div>'
            + (constitution.name_en ? '<div style="margin-top:.5rem;font-size:.88rem;color:var(--ink);">Constitution: <strong>' + constitution.name_en + '</strong> · ' + (constitution.name_zh || '') + '</div>' : '')
            + '</div>';
        }).join('');
      }

      var el = document.getElementById('doc-patients');
      if (el) el.innerHTML = html;
    } catch (e) { showToast(e.message || 'Failed to load tongue reports'); }
  };

  // ── View patient detail (consultation history) ──
  window.viewPatientDetail = async function (patientId) {
    try {
      var res = await A.api.get('/doctor/patients/' + patientId + '/consultations');
      var patient = res.patient || {};
      var pp = patient.patient_profile || {};
      var appts = res.appointments || [];

      var html = '<h3>' + (pp.full_name || patient.email) + '</h3>'
        + '<button class="btn-ghost" onclick="loadDocPatients()" style="margin-bottom:1rem;">← Back · 返回</button>'
        // Patient info card
        + '<div style="background:var(--washi);border:1px solid var(--mist);padding:1rem;margin-bottom:1.5rem;display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;font-size:.82rem;">'
        + '<div><div style="font-size:.65rem;color:var(--gold);text-transform:uppercase;">IC</div>' + (pp.ic_number || '—') + '</div>'
        + '<div><div style="font-size:.65rem;color:var(--gold);text-transform:uppercase;">Phone</div>' + (pp.phone || '—') + '</div>'
        + '<div><div style="font-size:.65rem;color:var(--gold);text-transform:uppercase;">Blood Type</div>' + (pp.blood_type || '—') + '</div>'
        + '<div><div style="font-size:.65rem;color:var(--gold);text-transform:uppercase;">Allergies</div>' + (pp.allergies || '—') + '</div>'
        + '</div>'
        + '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem;">Consultation History · 問診記錄</div>';

      if (!appts.length) {
        html += '<p style="color:var(--stone);">No consultations yet · 暫無問診記錄</p>';
      } else {
        html += appts.map(function (a) {
          var c = a.consultation || {};
          var rx = a.prescription || {};
          var rxItems = (rx.items || []).map(function (i) { return i.drug_name; }).join(', ');
          return '<div style="background:var(--washi);border:1px solid var(--mist);border-left:3px solid ' + (a.status === 'completed' ? 'var(--sage)' : 'var(--gold)') + ';padding:1rem;margin-bottom:.6rem;">'
            + '<div style="display:flex;justify-content:space-between;">'
            + '<strong>' + formatDate(a.scheduled_start) + '</strong>'
            + '<span style="font-size:.68rem;padding:.15rem .4rem;border-radius:3px;background:var(--washi-dark);color:var(--stone);">' + a.status + '</span>'
            + '</div>'
            + (c.doctor_notes ? '<div style="margin-top:.5rem;font-size:.85rem;color:var(--stone);"><em>' + c.doctor_notes + '</em></div>' : '')
            + (c.duration_seconds ? '<div style="font-size:.75rem;color:var(--stone);margin-top:.3rem;">Duration: ' + Math.floor(c.duration_seconds / 60) + ' min</div>' : '')
            + (rx.diagnosis ? '<div style="margin-top:.5rem;font-size:.82rem;">Dx: ' + rx.diagnosis + '</div>' : '')
            + (rxItems ? '<div style="font-size:.78rem;color:var(--stone);">Rx: ' + rxItems + '</div>' : '')
            + '</div>';
        }).join('');
      }

      var el = document.getElementById('doc-patients');
      if (el) el.innerHTML = html;
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // D-10: CONSULTATION RECORDS (own history)
  // ================================================================
  async function loadDocRecords() {
    var el = document.getElementById('doc-records');
    if (!el) return;
    try {
      var [apptRes, rxRes] = await Promise.allSettled([
        A.doctor.listAppointments('status=completed'),
        A.doctor.listPrescriptions(),
      ]);
      var appts = apptRes.status === 'fulfilled' ? (apptRes.value.data || []) : [];
      var rxs = rxRes.status === 'fulfilled' ? (rxRes.value.data || []) : [];

      el.innerHTML = ''
        + '<h3>Consultation Records · 問診記錄</h3>'
        + '<div class="sub-label">Your past consultations · 您的歷史問診</div>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;margin:1rem 0;">'
        + '<div class="ph-stat"><div class="ph-stat-num">' + appts.length + '</div><div class="ph-stat-label">Completed · 已完成</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">' + rxs.length + '</div><div class="ph-stat-label">Prescriptions · 處方</div></div>'
        + '<div class="ph-stat"><div class="ph-stat-num">' + rxs.filter(function (r) { return r.status === 'issued'; }).length + '</div><div class="ph-stat-label">Active Rx · 有效處方</div></div>'
        + '</div>';

      if (!appts.length) {
        el.innerHTML += '<p style="color:var(--stone);">No completed consultations yet · 暫無完成的問診</p>';
        return;
      }

      el.innerHTML += appts.map(function (a) {
        var matchedRx = rxs.filter(function (r) { return r.appointment_id === a.id; });
        return '<div style="background:var(--washi);border:1px solid var(--mist);border-left:3px solid var(--sage);padding:1rem;margin-bottom:.6rem;">'
          + '<div style="display:flex;justify-content:space-between;">'
          + '<div><strong>' + formatDate(a.scheduled_start) + '</strong>'
          + '<div style="font-size:.78rem;color:var(--stone);">Patient #' + a.patient_id + ' · RM ' + parseFloat(a.fee).toFixed(0) + '</div></div>'
          + '<button class="ph-btn-outline" style="font-size:.65rem;" onclick="viewPatientDetail(' + a.patient_id + ')">View Patient</button>'
          + '</div>'
          + (matchedRx.length ? matchedRx.map(function (rx) {
              return '<div style="margin-top:.5rem;font-size:.82rem;"><span style="color:var(--gold);">Rx:</span> ' + (rx.diagnosis || '—')
                + ' · ' + (rx.items || []).map(function (i) { return i.drug_name; }).join(', ')
                + ' <span style="font-size:.7rem;padding:.1rem .3rem;border-radius:2px;background:var(--washi-dark);">' + rx.status + '</span></div>';
            }).join('') : '')
          + '</div>';
      }).join('');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load records</p>'; }
  }

  // ================================================================
  // D-14: HELP & SUPPORT
  // ================================================================
  function loadDocHelp() {
    var el = document.getElementById('doc-help');
    if (!el) return;
    el.innerHTML = ''
      + '<h3>Help & Support · 幫助與支持</h3>'
      + '<div class="sub-label">Resources for doctors · 醫師資源</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem;">'
      + helpCard('📋', 'How to start a consultation', '如何開始問診', 'Click "Start" on an appointment → Video opens → Write notes → Issue prescription → End call.')
      + helpCard('📝', 'How to issue prescriptions', '如何開立處方', 'During or after consultation → Click "Issue Prescription" → Add drug items → Submit.')
      + helpCard('📅', 'How to set your schedule', '如何設定排班', 'Go to Settings → Add time slots for each weekday → Patients can only book your open slots.')
      + helpCard('💰', 'How to request withdrawal', '如何申請提現', 'Go to Earnings → Check available balance → Click "Request Withdrawal" → Admin reviews.')
      + helpCard('💬', 'How to chat with patients', '如何與患者聊天', 'Go to Patient List → Click "Chat" next to a patient → Send messages and images.')
      + helpCard('👅', 'How to view tongue reports', '如何查看舌診報告', 'Go to Patient List → Click "Tongue" → View all tongue scans with AI analysis.')
      + helpCard('📄', 'How to issue MC / Referral', '如何開病假條/轉介信', 'During video consultation → Use the side panel buttons → Fill in details → Print.')
      + helpCard('📞', 'Contact support', '聯絡客服', 'Email: support@hansmed.com.my<br>WhatsApp: +60 12-345 6789<br>Hours: Mon-Fri 9am-6pm')
      + '</div>';
  }

  function helpCard(icon, title, titleZh, body) {
    return '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.2rem;">'
      + '<div style="font-size:1.5rem;margin-bottom:.5rem;">' + icon + '</div>'
      + '<div style="font-size:.92rem;color:var(--ink);font-weight:500;">' + title + '</div>'
      + '<div style="font-size:.78rem;color:var(--gold);margin-bottom:.5rem;">' + titleZh + '</div>'
      + '<div style="font-size:.82rem;color:var(--stone);line-height:1.6;">' + body + '</div>'
      + '</div>';
  }

  // ── Helpers ──
  function field(id, label, value, type) {
    return '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;font-size:.95rem;"' + (type === true ? ' disabled' : '') + '></div>';
  }
  function esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function formatDate(s) { if (!s) return '—'; return new Date(s).toLocaleString('en-MY', { day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit' }); }

  console.log('[HansMed] Doctor extras (D-02/05/06/10/14) loaded');
})();
