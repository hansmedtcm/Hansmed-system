/**
 * Doctor Patient List + Patient Detail
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  // Cache of last-rendered patient detail data, keyed by patient id —
  // lets inline onclick handlers (referral / MC / case-record viewer /
  // tongue-history viewer) hand the full patient and appointment
  // objects back to the modal openers without re-fetching.
  var _ctx = { byPatient: {} };

  // ── Collapsible-section preferences ──
  // Persisted per-doctor in localStorage so once a user collapses a
  // section it stays collapsed across reloads. Keys are short, the
  // 'true' value means 'collapsed'.
  function isSectionCollapsed(key) {
    try { return localStorage.getItem('hm-pdetail-collapse-' + key) === '1'; } catch (_) { return false; }
  }
  function setSectionCollapsed(key, on) {
    try { localStorage.setItem('hm-pdetail-collapse-' + key, on ? '1' : '0'); } catch (_) {}
  }

  /**
   * Render a collapsible section wrapper with a clickable header.
   * Caller passes the inner HTML and the persistent storage key.
   * Header has a chevron that flips on toggle; click anywhere on the
   * header bar (including the title) to collapse/expand.
   *
   *   collapsibleSection({
   *     key:     'dob',
   *     icon:    '🌿',
   *     titleEn: 'Constitution Aide',
   *     titleZh: '體質分析',
   *     extras:  '<button>View All</button>',  // optional right-side controls
   *     body:    '<div>…</div>'
   *   })
   */
  function collapsibleSection(o) {
    var collapsed = isSectionCollapsed(o.key);
    return '<div class="card mb-4" data-collapse-key="' + o.key + '" style="padding:0;overflow:hidden;">' +
      '<div class="collapsible-head" data-collapse-toggle="' + o.key + '" ' +
        'style="display:flex;align-items:center;gap:var(--s-2);padding:14px 18px;cursor:pointer;background:var(--washi);border-bottom:' +
          (collapsed ? 'none' : '1px solid var(--border)') + ';user-select:none;">' +
        '<span style="font-size:18px;">' + (o.icon || '▦') + '</span>' +
        '<div style="flex:1;font-weight:600;font-size:14px;color:var(--ink);">' +
          '<span lang="en">' + (o.titleEn || '') + '</span>' +
          (o.titleZh ? '<span lang="zh">' + (o.titleZh || '') + '</span>' : '') +
        '</div>' +
        (o.extras ? '<div onclick="event.stopPropagation();">' + o.extras + '</div>' : '') +
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;transition:transform 0.2s;transform:rotate(' + (collapsed ? '-90deg' : '0deg') + ');">' +
          '<path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</div>' +
      '<div class="collapsible-body" data-collapse-body="' + o.key + '" style="' +
        (collapsed ? 'display:none;' : '') + 'padding:var(--s-3) var(--s-4) var(--s-4);">' +
        o.body +
      '</div>' +
    '</div>';
  }

  /** Wire the click handlers for every collapsible section in a panel. */
  function wireCollapsibles(rootEl) {
    rootEl.querySelectorAll('[data-collapse-toggle]').forEach(function (head) {
      head.addEventListener('click', function () {
        var key = head.getAttribute('data-collapse-toggle');
        var body = rootEl.querySelector('[data-collapse-body="' + key + '"]');
        var chev = head.querySelector('svg');
        if (! body) return;
        var open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        if (chev) chev.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)';
        head.style.borderBottom = open ? 'none' : '1px solid var(--border)';
        setSectionCollapsed(key, open);
      });
    });
  }

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">My Patients · 我的患者</div>' +
      '<h1 class="page-title">Patient List</h1></div>' +
      '<button class="btn btn--primary" id="pt-book-any">+ New Appointment · 新建預約</button>' +
      '</div>' +
      '<input id="pt-search" type="text" class="field-input field-input--boxed mb-4" placeholder="Search by name, IC, phone… · 搜尋" style="max-width: 400px;">' +
      '<div id="pt-list"></div>';

    document.getElementById('pt-book-any').addEventListener('click', function () { showBookModal(null, null); });
    await load();
    document.getElementById('pt-search').addEventListener('input', debounce(load, 300));
  }

  async function load() {
    var container = document.getElementById('pt-list');
    if (!container) return;
    var search = document.getElementById('pt-search') ? document.getElementById('pt-search').value : '';
    HM.state.loading(container);
    try {
      var res = await HM.api.doctor.listPatients(search ? 'search=' + encodeURIComponent(search) : '');
      var items = res.data || [];

      if (!items.length) {
        HM.state.empty(container, {
          icon: '👥',
          title: 'No patients yet',
          text: 'Patients will appear here after their first consultation with you',
        });
        return;
      }

      container.innerHTML = '';
      items.forEach(function (p) {
        var pp = p.patient_profile || {};
        var name = pp.full_name || pp.nickname || p.email;
        var data = {
          id: p.id,
          initial: name.charAt(0).toUpperCase(),
          name: name,
          contact: [pp.ic_number, pp.phone].filter(Boolean).join(' · '),
          visits_text: (p.appointment_count || 0) + ' visits',
          last_visit_text: p.last_visit ? 'Last: ' + HM.format.date(p.last_visit) : '',
        };
        var node = HM.render.fromTemplate('tpl-patient-card', data);
        node.querySelector('[data-action="view"]').addEventListener('click', function () {
          location.hash = '#/patients/' + p.id;
        });
        container.appendChild(node);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function renderDetail(el, id) {
    HM.state.loading(el);
    try {
      var results = await Promise.all([
        HM.api.doctor.patientConsults(id),
        HM.api.doctor.patientTongue(id),
      ]);
      var consultRes = results[0];
      var tongueRes = results[1];

      var patient = consultRes.patient || {};
      var pp = patient.patient_profile || {};
      var name = pp.full_name || pp.nickname || patient.email;
      var appts = consultRes.appointments || [];
      var tongues = tongueRes.data || [];

      // Stash patient + appointments so the inline button handlers
      // (referral / MC) can read full objects back without round-tripping
      // the API. Keyed on patient id so multiple detail renders don't
      // clobber each other.
      _ctx.byPatient[patient.id] = { patient: patient, appts: appts, tongues: tongues };

      var html = '<div class="page-header">' +
        '<button class="btn btn--ghost" onclick="location.hash=\'#/patients\'">← Back to Patients</button>' +
        '</div>' +
        '<div class="card card--pad-lg mb-6">' +
        '<div class="flex flex-gap-4">' +
        '<div class="avatar avatar--lg" style="background: var(--ink); color: var(--gold);">' + name.charAt(0).toUpperCase() + '</div>' +
        '<div style="flex:1;">' +
        '<h2>' + HM.format.esc(name) + '</h2>' +
        '<p class="text-muted">' + (pp.ic_number || '') + ' · ' + (pp.phone || '') + ' · ' + (pp.gender || '') + '</p>' +
        '</div>' +
        '<div class="flex gap-2" style="flex-wrap:wrap;">' +
        '<button class="btn btn--primary btn--sm" onclick="HM.doctorPanels.patients._book(' + patient.id + ', \'' + HM.format.esc(name).replace(/'/g, "\\'") + '\')">+ Book Appointment · 預約</button>' +
        '<button class="btn btn--outline btn--sm" onclick="HM.doctorPanels.patients._chat(' + patient.id + ')">💬 Chat</button>' +
        '<button class="btn btn--outline btn--sm" onclick="HM.doctorPanels.patients._referral(' + patient.id + ')">📨 Referral · 轉介信</button>' +
        '</div>' +
        '</div>' +
        '<div class="grid-4 grid-auto mt-4" style="gap: var(--s-3);">' +
        summaryCell('Date of Birth', pp.birth_date ? String(pp.birth_date).substring(0, 10) : '—') +
        summaryCell('Blood Type', pp.blood_type || '—') +
        summaryCell('Height / Weight', (pp.height_cm ? pp.height_cm + 'cm' : '—') + ' / ' + (pp.weight_kg ? pp.weight_kg + 'kg' : '—')) +
        summaryCell('Allergies', pp.allergies || 'None') +
        summaryCell('Medical History', HM.format.truncate(pp.medical_history || 'None', 50)) +
        '</div></div>' +

        // Wuyun Liuqi clinical analysis (doctor-only aide, hidden
        // from patient). Renders only when patient has a birth_date
        // on file. Wrapped in a collapsible card so doctors who
        // don't read the constitution analysis can hide it
        // permanently (preference persists in localStorage).
        collapsibleSection({
          key:     'dob',
          icon:    '🌿',
          titleEn: 'Constitution Aide (DOB analysis)',
          titleZh: '體質分析（出生日推算）',
          body:    '<div id="wyl-mount-patient"></div>',
        });

      // Tongue scans — collapsible. Header includes a 'View All'
      // button that opens a full-history modal with every tongue
      // assessment + its AI constitution report (the same data the
      // patient saw in their wellness panel).
      if (tongues.length) {
        var tongueCards = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--s-3);">';
        tongues.slice(0, 3).forEach(function (t) {
          var c = (t.constitution_report && t.constitution_report.constitution) || {};
          var thumb = t.image_url
            ? '<img src="' + HM.format.esc(t.image_url) + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r-md);border:1px solid var(--border);margin-bottom:var(--s-2);">'
            : '<div style="width:100%;aspect-ratio:1;background:var(--washi);border:1px dashed var(--border);border-radius:var(--r-md);display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mu);margin-bottom:var(--s-2);text-align:center;padding:var(--s-2);">' +
                '<div style="font-size:28px;opacity:0.5;margin-bottom:4px;">📷</div>' +
                '<div style="font-size:11px;line-height:1.4;"><span lang="en">Photo no longer available</span><span lang="zh">照片已不可用</span></div>' +
              '</div>';
          tongueCards += '<div class="card" style="cursor:pointer;" onclick="HM.doctorPanels.patients._viewTongue(' + patient.id + ',' + t.id + ')" title="Click for full report">' +
            thumb +
            '<div class="text-label">' + HM.format.date(t.created_at) + '</div>' +
            '<div class="text-sm mt-1">' + HM.format.esc(c.name_en || 'Analysis') + '</div>' +
            '<div class="text-xs text-muted">Score: ' + (t.health_score || '—') + '/100</div>' +
            '</div>';
        });
        tongueCards += '</div>';

        var viewAllBtn = '<button class="btn btn--ghost btn--sm" onclick="HM.doctorPanels.patients._viewAllTongues(' + patient.id + ')" style="font-size:11px;padding:4px 10px;">' +
          '📜 <span lang="en">View All</span><span lang="zh">查看全部</span>' +
        '</button>';

        html += collapsibleSection({
          key:     'tongue',
          icon:    '👅',
          titleEn: 'AI Wellness History · ' + tongues.length + ' assessment' + (tongues.length === 1 ? '' : 's'),
          titleZh: 'AI 健康評估記錄（' + tongues.length + ' 筆）',
          extras:  viewAllBtn,
          body:    tongueCards,
        });
      }

      // Pool-review access banner — backend sets pool_review_access=true
      // on the response when (a) this patient is in the shared review
      // queue AND (b) the response includes consults from doctors other
      // than the current viewer. Surface that explicitly so the
      // reviewing doctor knows they're seeing extra clinical history
      // they wouldn't normally have access to.
      if (consultRes.pool_review_access) {
        html +=
          '<div class="alert alert--info mb-4" style="border-left:3px solid var(--gold,#B8965A);">' +
            '<div class="alert-body" style="font-size:13px;">' +
              '<strong>🔓 Pool Review Access · 共享審核權限</strong><br>' +
              '<span lang="en">You are viewing this patient\'s consultation history from other practitioners because they currently have a pending review in the AI Reviews queue. Access closes once the review is approved or rejected.</span>' +
              '<span lang="zh" style="font-family:var(--font-zh);">由於此患者目前有待審核的 AI 報告，您可暫時查看其他中醫師的問診記錄。審核完成後該權限將自動關閉。</span>' +
            '</div>' +
          '</div>';
      }

      // Consultations — expanded card shows the full case record
      // (chief complaint, BP, pulse, body diagram findings, doctor's
      // notes), treatments performed, and the full prescription.
      // This is the doctor's clinical record for the patient.
      html += '<div class="text-label mb-3">Consultation History · 問診記錄 (' + appts.length + ')</div>';
      if (!appts.length) {
        html += '<div class="card"><p class="text-muted text-center">No consultations yet · 暫無問診記錄</p></div>';
      } else {
        // Used below to decide whether to label a consultation card
        // with the treating doctor's name. Only shown when the treater
        // is someone other than the current viewer (i.e. when this
        // doctor is reviewing the patient via the shared pool).
        var viewer = (HM.api && HM.api.getUser && HM.api.getUser()) || {};
        var viewerId = viewer.id;

        appts.forEach(function (a) {
          var c = a.consultation || {};
          // case_record + treatments are JSON-casted on the model but
          // legacy rows can come back as a JSON STRING (Laravel cast
          // wasn't always set) — so try to parse before falling back
          // to {}. Same defensive parse for treatments below.
          var cr = {};
          if (c.case_record) {
            if (typeof c.case_record === 'object') {
              cr = c.case_record;
            } else if (typeof c.case_record === 'string') {
              try { cr = JSON.parse(c.case_record) || {}; } catch (_) { cr = {}; }
            }
          }
          var rx = a.prescription || {};
          // Treatments — same defensive parse as case_record.
          var treatments = [];
          if (c.treatments) {
            if (Array.isArray(c.treatments)) {
              treatments = c.treatments;
            } else if (typeof c.treatments === 'string') {
              try { var parsed = JSON.parse(c.treatments); if (Array.isArray(parsed)) treatments = parsed; } catch (_) {}
            }
          }
          var bodyMarks  = Array.isArray(cr.body_marks) ? cr.body_marks : [];
          var rxItems    = Array.isArray(rx.items) ? rx.items : [];
          var visitBadge = (a.visit_type === 'walk_in')
            ? '<span class="badge" style="background:rgba(184,150,90,.15);color:var(--gold);font-size:10px;">🏥 Walk-in</span>'
            : '<span class="badge" style="background:rgba(74,144,217,.15);color:#4a90d9;font-size:10px;">📹 Online</span>';

          // If the consult was conducted by a doctor other than the
          // current viewer (only ever happens in pool-review access
          // mode), label the card so the reviewer knows it's not their
          // own note. Backend tags treating_doctor_name on each row.
          var treatingLabel = '';
          if (a.treating_doctor_name && a.doctor_id && a.doctor_id !== viewerId) {
            treatingLabel =
              '<div class="text-xs mt-1" style="color:var(--wd-md,#9A6035);font-weight:500;">' +
                '<span lang="en">Treated by: ' + HM.format.esc(a.treating_doctor_name) + '</span>' +
                '<span lang="zh" style="font-family:var(--font-zh);">主治醫師：' + HM.format.esc(a.treating_doctor_name) + '</span>' +
              '</div>';
          }

          html += '<div class="card card--bordered mb-3" style="border-left-color: ' +
            (a.status === 'completed' ? 'var(--sage)' : 'var(--gold)') + ';">' +
            '<div class="flex-between mb-2" style="align-items:flex-start;gap:var(--s-2);">' +
              '<div>' +
                '<strong>' + HM.format.datetime(a.scheduled_start) + '</strong> ' + visitBadge +
                (a.concern_label ? '<div class="text-xs text-muted mt-1">Concern: ' + HM.format.esc(a.concern_label) + '</div>' : '') +
                treatingLabel +
              '</div>' +
              '<div class="flex gap-2" style="align-items:center;flex-wrap:wrap;justify-content:flex-end;">' +
                HM.format.statusBadge(a.status) +
                // 'View Details' opens a modal showing every field the
                // doctor saved on this visit — full case record, body
                // diagrams, documents, treatments, prescription. Goes
                // beyond the inline summary cards which only surface
                // the highlights.
                '<button class="btn btn--ghost btn--sm" style="padding:4px 10px;font-size:11px;" onclick="HM.doctorPanels.patients._viewCase(' + patient.id + ',' + a.id + ')">📄 <span lang="en">View Details</span><span lang="zh">查看詳情</span></button>' +
                // MC issuance is offered for completed visits — that's
                // where a real diagnosis exists to write into the cert.
                (a.status === 'completed'
                  ? '<button class="btn btn--ghost btn--sm" style="padding:4px 10px;font-size:11px;" onclick="HM.doctorPanels.patients._mc(' + patient.id + ',' + a.id + ')">📋 Issue MC</button>'
                  : '') +
              '</div>' +
            '</div>';

          // ── Case Record block ──────────────────────────────────
          // Renders EVERY field the doctor saves during consultation.
          // Field names mirror what captureCaseRecord() in consult.js
          // writes — read both 'bp' and 'blood_pressure' because old
          // legacy rows used 'bp' while the current consult page saves
          // 'blood_pressure'. Body diagrams (front + back) embedded
          // inline as PNG so the doctor can see exactly where the
          // patient pointed to pain on past visits. Documents listed
          // with file names so legacy lab reports / MC scans still
          // surface even if the storage volume cleared the binary.
          // Trim every string field so accidental whitespace-only
          // saves don't fool hasCR into showing empty rows.
          function nz(v) { return (v == null) ? '' : String(v).trim(); }
          var bp   = nz(cr.blood_pressure) || nz(cr.bp);
          var pulse = nz(cr.pulse);
          var docs = Array.isArray(cr.documents) ? cr.documents : [];
          // Current save path writes a single combined canvas to
          // body_combined; legacy / future split-view rows may use
          // body_front + body_back. Accept any of the three so the
          // diagram surfaces regardless of which shape is on disk.
          var hasBodyDiagram = !! (cr.body_combined || cr.body_front || cr.body_back);
          var hasCR = nz(cr.chief_complaint) || nz(cr.present_illness) || nz(cr.past_history) ||
                      bp || pulse || nz(cr.pattern_diagnosis) || nz(cr.western_diagnosis) ||
                      nz(cr.treatment_principle) || nz(cr.doctor_instructions) ||
                      bodyMarks.length || hasBodyDiagram || docs.length;

          // Always render the section header so the doctor knows
          // whether the case record is actually empty (no fields
          // filled during the consult) vs. missing due to a render
          // bug. When nothing was entered, the inner content shows a
          // gentle 'no case record entered' line — easier to debug.
          html += '<div class="mt-2" style="background:var(--washi);padding:var(--s-3) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--gold);">' +
            '<div class="flex-between" style="align-items:baseline;">' +
              '<div class="text-label mb-2" style="font-size:10px;">📋 Case Record · 病歷</div>' +
              (! hasCR ? '<div class="text-xs text-muted">no case record entered · 未填寫病歷</div>' : '') +
            '</div>';
          // Diagnostic: log raw case_record so when users report 'I see
          // labels with no values' we can see exactly what's in the
          // saved row. Cheap, only fires when the case-record block
          // exists. Strip after a few weeks of stable behaviour.
          if (window.HM && HM.api && c.case_record !== undefined) {
            try { console.log('[case_record dump]', a.id, a.scheduled_start, c.case_record); } catch (_) {}
          }

          if (hasCR) {

            // Helper to add a labelled row only when the trimmed value
            // is non-empty. Trims defensively in case a stored value
            // is something like ' ' or '\n' which is truthy but reads
            // as blank in the UI.
            function row(label, labelZh, value) {
              var v = (value == null) ? '' : String(value).trim();
              if (! v) return '';
              return '<div class="text-sm mt-1" style="line-height:1.5;">' +
                '<strong>' + label + ' · ' + labelZh + ':</strong> ' +
                HM.format.esc(v) +
              '</div>';
            }

            html += row('Chief Complaint', '主訴', cr.chief_complaint);
            html += row('Present Illness', '現病史', cr.present_illness);
            html += row('Past History',    '既往史', cr.past_history);

            // Vitals (BP + pulse on same row when both present).
            // Both already trimmed at the top via nz().
            if (bp || pulse) {
              html += '<div class="text-sm mt-1" style="line-height:1.5;">';
              if (bp)    html += '<strong>BP · 血壓:</strong> ' + HM.format.esc(bp);
              if (bp && pulse) html += ' · ';
              if (pulse) html += '<strong>Pulse · 脈診:</strong> ' + HM.format.esc(pulse);
              html += '</div>';
            }

            html += row('TCM Pattern',     '中醫證型', cr.pattern_diagnosis);
            html += row('Western Dx',      '西醫診斷', cr.western_diagnosis);
            html += row('Treatment Principle', '治法治則', cr.treatment_principle);
            html += row('Doctor Instructions', '醫囑',   cr.doctor_instructions);

            // Body diagrams — render inline as small thumbnails the
            // doctor can click to enlarge in a new window.
            if (hasBodyDiagram) {
              html += '<div class="text-sm mt-2"><strong>Body Diagram · 身體圖示:</strong></div>' +
                '<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">';
              // Prefer the single combined canvas — that's what the
              // current consult.js save path writes. Only fall back to
              // the legacy split front/back fields when body_combined
              // isn't on the row.
              if (cr.body_combined) {
                html += '<a href="' + HM.format.esc(cr.body_combined) + '" target="_blank" rel="noopener" title="Body diagram">' +
                  '<img src="' + HM.format.esc(cr.body_combined) + '" style="height:96px;width:auto;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;">' +
                  '</a>';
              } else {
                if (cr.body_front) {
                  html += '<a href="' + HM.format.esc(cr.body_front) + '" target="_blank" rel="noopener" title="Front view">' +
                    '<img src="' + HM.format.esc(cr.body_front) + '" style="height:96px;width:auto;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;">' +
                    '<div class="text-xs text-muted text-center mt-1">Front · 正面</div>' +
                    '</a>';
                }
                if (cr.body_back) {
                  html += '<a href="' + HM.format.esc(cr.body_back) + '" target="_blank" rel="noopener" title="Back view">' +
                    '<img src="' + HM.format.esc(cr.body_back) + '" style="height:96px;width:auto;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;">' +
                    '<div class="text-xs text-muted text-center mt-1">Back · 背面</div>' +
                    '</a>';
                }
              }
              html += '</div>';
            }

            // Body marks (interactive pin-on-figure) — show points if detail data is there
            if (bodyMarks.length) {
              html += '<div class="text-xs text-muted mt-2"><strong>Body marks · 標記:</strong> ' + bodyMarks.length + ' point(s) recorded';
              // Try to surface actual labels if the marks have them
              var labelled = bodyMarks
                .filter(function (m) { return m && (m.label || m.note); })
                .map(function (m) { return HM.format.esc(m.label || m.note); });
              if (labelled.length) html += ' — ' + labelled.join(', ');
              html += '</div>';
            }

            // Document attachments — show name + size + a click-through.
            // Some legacy rows store {name, dataUrl}, newer rows store
            // {name, url, size}. Handle both.
            if (docs.length) {
              html += '<div class="text-sm mt-2"><strong>Documents · 文件 (' + docs.length + '):</strong></div>' +
                '<ul style="list-style:none;padding:0;margin:6px 0 0;">';
              docs.forEach(function (d) {
                if (! d) return;
                var href = d.url || d.dataUrl || '';
                var name = d.name || d.filename || 'document';
                var size = d.size ? ' · ' + Math.round(d.size / 1024) + ' KB' : '';
                html += '<li class="text-xs mt-1">📎 ' +
                  (href
                    ? '<a href="' + HM.format.esc(href) + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:underline;">' + HM.format.esc(name) + '</a>'
                    : HM.format.esc(name)) +
                  '<span class="text-muted">' + size + '</span></li>';
              });
              html += '</ul>';
            }
          }
          // Always close the section wrapper (open is unconditional now)
          html += '</div>';

          // ── Doctor notes from consultation (separate from case_record)
          if (c.doctor_notes) {
            html += '<div class="text-sm text-muted mt-2"><em>' + HM.format.esc(c.doctor_notes) + '</em></div>';
          }

          // ── Treatments performed
          if (treatments.length) {
            html += '<div class="mt-2" style="background:rgba(122,140,114,.08);padding:var(--s-2) var(--s-3);border-radius:var(--r-sm);border-left:2px solid var(--sage);">' +
              '<div class="text-label" style="font-size:10px;">💉 Treatments · 治療 (' + treatments.length + ')</div>';
            treatments.forEach(function (t) {
              html += '<div class="text-sm mt-1">' +
                (t.icon || '•') + ' <strong>' + HM.format.esc(t.name || t.key || '—') + '</strong>' +
                (t.name_zh ? ' · <span style="font-family:var(--font-zh);">' + HM.format.esc(t.name_zh) + '</span>' : '') +
                (t.points && t.points.length ? '<div class="text-xs text-muted">Points · 穴位: ' + t.points.map(HM.format.esc).join(', ') + '</div>' : '') +
                (t.notes ? '<div class="text-xs text-muted">' + HM.format.esc(t.notes) + '</div>' : '') +
                '</div>';
            });
            html += '</div>';
          }

          // ── Prescription with full items
          if (rx && (rx.diagnosis || rxItems.length)) {
            html += '<div class="mt-2" style="background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s-2) var(--s-3);">' +
              '<div class="text-label" style="font-size:10px;">💊 Prescription · 處方</div>';
            if (rx.diagnosis)    html += '<div class="text-sm mt-1"><strong>Dx · 診斷:</strong> ' + HM.format.esc(rx.diagnosis) + '</div>';
            if (rx.instructions) html += '<div class="text-sm mt-1"><strong>Instructions · 醫囑:</strong> ' + HM.format.esc(rx.instructions) + '</div>';
            if (rxItems.length) {
              html += '<div class="text-xs text-muted mt-2" style="display:flex;flex-wrap:wrap;gap:6px;">';
              rxItems.forEach(function (it) {
                html += '<span style="background:var(--washi);padding:2px 8px;border-radius:999px;border:1px solid var(--border);">' +
                  HM.format.esc(it.drug_name || '') + ' ' + (it.quantity || '') + (it.unit || 'g') +
                  '</span>';
              });
              html += '</div>';
            }
            html += '</div>';
          }

          html += '</div>';
        });
      }

      el.innerHTML = html;

      // Wire all the collapsible section toggles in this panel.
      // Persists open/closed state per-section to localStorage.
      wireCollapsibles(el);

      // Mount dual Wuyun Liuqi card — innate constitution from DOB plus
      // today's environmental qi so the doctor can weigh both at review time.
      if (window.HM && HM.wuyunLiuqi) {
        HM.wuyunLiuqi.mountDual(document.getElementById('wyl-mount-patient'), pp.birth_date || null);
      }
    } catch (e) { HM.state.error(el, e); }
  }

  function summaryCell(label, val) {
    return '<div><div class="text-label" style="font-size: 0.6rem;">' + label + '</div><div class="text-sm mt-1">' + HM.format.esc(val) + '</div></div>';
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function showBookModal(prefilledId, prefilledName) {
    var todayStr = new Date().toISOString().slice(0, 10);
    var nowTime = new Date();
    nowTime.setMinutes(0, 0, 0);
    nowTime.setHours(nowTime.getHours() + 1);
    var defaultTime = String(nowTime.getHours()).padStart(2, '0') + ':00';

    var content = '<form id="dbook-form">' +
      '<div class="field"><label class="field-label" data-required>Patient</label>';

    if (prefilledId) {
      content += '<input type="hidden" name="patient_id" value="' + prefilledId + '">' +
        '<input type="text" class="field-input field-input--boxed" value="' + HM.format.esc(prefilledName) + ' (#' + prefilledId + ')" readonly>';
    } else {
      content += '<select name="patient_id" id="dbook-patient" class="field-input field-input--boxed" required>' +
        '<option value="">Loading patients…</option>' +
        '</select>';
    }

    content += '</div>' +

      '<div class="field">' +
      '<label class="field-label" data-required>Visit Type · 就診方式</label>' +
      '<div class="flex gap-2 flex-wrap">' +
      '<label class="radio-option"><input type="radio" name="visit_type" value="walk_in" checked> 🏥 Walk-in · 臨診 (in-person)</label>' +
      '<label class="radio-option"><input type="radio" name="visit_type" value="online"> 📹 Online · 線上 (video)</label>' +
      '</div>' +
      '<div class="text-xs text-muted mt-1">Walk-in visits skip video and focus on the case record / treatments log. · 臨診無需視訊，直接記錄病歷與治療。</div>' +
      '</div>' +

      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label" data-required>Date · 日期</label>' +
      '<input type="date" name="date" class="field-input field-input--boxed" required min="' + todayStr + '" value="' + todayStr + '"></div>' +
      '<div class="field"><label class="field-label" data-required>Time · 時段</label>' +
      '<input type="time" name="time" class="field-input field-input--boxed" required value="' + defaultTime + '" step="900"></div>' +
      '</div>' +

      '<div class="field-grid field-grid--2">' +
      '<div class="field"><label class="field-label">Duration (min)</label>' +
      '<select name="duration" class="field-input field-input--boxed">' +
      '<option value="30">30 minutes</option><option value="45">45 minutes</option>' +
      '<option value="60" selected>60 minutes</option><option value="90">90 minutes</option>' +
      '</select></div>' +
      '<div class="field"><label class="field-label">Fee (RM)</label>' +
      '<input type="number" name="fee" min="0" step="0.01" class="field-input field-input--boxed" value="0" placeholder="0 = no charge"></div>' +
      '</div>' +

      '<div class="field"><label class="field-label">Concern · 主訴</label>' +
      '<input type="text" name="concern_label" class="field-input field-input--boxed" placeholder="e.g. Follow-up, Headache, Cold"></div>' +

      '<div class="field"><label class="field-label">Notes · 備註</label>' +
      '<textarea name="notes" class="field-input field-input--boxed" rows="3" placeholder="Reason for booking, anything to prepare…"></textarea></div>' +

      '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
      '<button type="submit" class="btn btn--primary btn--block mt-4">Create Appointment · 建立預約</button>' +
      '</form>';

    var m = HM.ui.modal({
      size: 'md',
      title: 'New Appointment for Patient · 為患者新建預約',
      content: content,
    });

    var form = m.element.querySelector('#dbook-form');

    if (!prefilledId) {
      // Populate the patient dropdown
      HM.api.doctor.listPatients('').then(function (res) {
        var select = m.element.querySelector('#dbook-patient');
        var items = res.data || [];
        if (!items.length) {
          select.innerHTML = '<option value="">No patients on file yet</option>';
          return;
        }
        select.innerHTML = '<option value="">— Select a patient —</option>' +
          items.map(function (p) {
            var pp = p.patient_profile || {};
            var name = pp.full_name || pp.nickname || p.email;
            return '<option value="' + p.id + '">' + HM.format.esc(name) + ' (#' + p.id + ')</option>';
          }).join('');
      }).catch(function () {
        m.element.querySelector('#dbook-patient').innerHTML = '<option value="">Failed to load patients</option>';
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var data = HM.form.serialize(form);
      var startStr = data.date + 'T' + data.time + ':00';
      var endDate = new Date(startStr);
      endDate.setMinutes(endDate.getMinutes() + parseInt(data.duration || '60', 10));
      var endIso = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0') + 'T' +
        String(endDate.getHours()).padStart(2, '0') + ':' +
        String(endDate.getMinutes()).padStart(2, '0') + ':00';

      var payload = {
        patient_id: parseInt(data.patient_id, 10),
        scheduled_start: startStr,
        scheduled_end: endIso,
        fee: parseFloat(data.fee || '0'),
        concern_label: data.concern_label || null,
        notes: data.notes || null,
        visit_type: data.visit_type || 'walk_in',
      };

      HM.form.setLoading(form, true);
      try {
        var res = await HM.api.doctor.createAppointment(payload);
        m.close();
        HM.ui.toast('Appointment created · 預約已建立', 'success');
        // Refresh the patient list / detail view
        if (location.hash.indexOf('#/patients/') === 0) {
          renderDetail(document.getElementById('panel-container'), payload.patient_id);
        } else {
          load();
        }
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Could not create appointment');
      }
    });
  }

  HM.doctorPanels.patients = {
    render: render,
    renderDetail: renderDetail,
    _chat: async function (patientId) {
      try {
        var r = await HM.api.chat.openThread({ patient_id: patientId });
        location.hash = '#/messages/' + r.thread.id;
      } catch (e) { HM.ui.toast('Could not open chat', 'danger'); }
    },
    _book: function (patientId, patientName) {
      showBookModal(patientId, patientName);
    },
    _referral: function (patientId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      HM.doctorPanels.documents.openReferral(c.patient);
    },
    _mc: function (patientId, appointmentId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      var appt = (c.appts || []).find(function (a) { return a.id === appointmentId; });
      if (!appt) { HM.ui.toast('Could not find that appointment in this patient\'s history', 'warn'); return; }
      HM.doctorPanels.documents.openMc(c.patient, appt);
    },

    /** Full case record modal for one consultation date. */
    _viewCase: function (patientId, appointmentId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      var appt = (c.appts || []).find(function (a) { return a.id === appointmentId; });
      if (!appt) { HM.ui.toast('Could not find that appointment', 'warn'); return; }
      openCaseRecordModal(c.patient, appt);
    },

    /** Single tongue assessment modal — full AI report. */
    _viewTongue: function (patientId, tongueId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      var t = (c.tongues || []).find(function (x) { return x.id === tongueId; });
      if (!t) { HM.ui.toast('Could not find that tongue assessment', 'warn'); return; }
      openTongueDetailModal(c.patient, t);
    },

    /** Full history of every tongue assessment + AI wellness data. */
    _viewAllTongues: function (patientId) {
      var c = _ctx.byPatient[patientId];
      if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
      openTongueHistoryModal(c.patient, c.tongues || []);
    },
  };

  // ── Modal: Full Case Record for a single consultation ──
  // Shows EVERY field the doctor entered during this visit, even
  // labels that have no value (so the doctor knows what fields were
  // available during that visit). Body diagrams render full-size,
  // documents are downloadable, treatments and prescription are
  // included in one scrollable view.
  function openCaseRecordModal(patient, a) {
    var c = a.consultation || {};
    var cr = {};
    if (c.case_record) {
      if (typeof c.case_record === 'object') cr = c.case_record;
      else if (typeof c.case_record === 'string') {
        try { cr = JSON.parse(c.case_record) || {}; } catch (_) {}
      }
    }
    var treatments = [];
    if (c.treatments) {
      if (Array.isArray(c.treatments)) treatments = c.treatments;
      else if (typeof c.treatments === 'string') {
        try { var p = JSON.parse(c.treatments); if (Array.isArray(p)) treatments = p; } catch (_) {}
      }
    }
    var rx = a.prescription || {};
    var rxItems = Array.isArray(rx.items) ? rx.items : [];
    var bodyMarks = Array.isArray(cr.body_marks) ? cr.body_marks : [];
    var docs = Array.isArray(cr.documents) ? cr.documents : [];
    var bp = (cr.blood_pressure || cr.bp || '').toString().trim();

    function f(label, labelZh, value) {
      var v = (value == null) ? '' : String(value).trim();
      return '<div style="margin-bottom:14px;">' +
        '<div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">' +
          esc(label) + ' · ' + esc(labelZh) +
        '</div>' +
        '<div style="font-size:14px;color:var(--ink);line-height:1.6;white-space:pre-wrap;">' +
          (v ? esc(v) : '<span class="text-muted" style="font-style:italic;">— not recorded —</span>') +
        '</div>' +
      '</div>';
    }
    function esc(s) { return HM.format.esc(s); }

    var pp = patient.patient_profile || {};
    var name = pp.full_name || pp.nickname || patient.email;

    var content =
      '<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border);">' +
        '<div style="font-size:13px;color:var(--mu);">' +
          (a.visit_type === 'walk_in' ? '🏥 Walk-in' : '📹 Online') + ' · ' +
          HM.format.datetime(a.scheduled_start) +
        '</div>' +
        '<div style="font-size:18px;font-weight:600;color:var(--ink);margin-top:4px;">' +
          esc(name) + (a.concern_label ? ' — ' + esc(a.concern_label) : '') +
        '</div>' +
      '</div>' +

      // Vitals row
      (bp || cr.pulse
        ? '<div style="display:flex;gap:24px;margin-bottom:18px;padding:10px 14px;background:var(--washi);border-radius:var(--r-sm);">' +
            (bp ? '<div><div class="text-xs text-muted">BP · 血壓</div><strong>' + esc(bp) + '</strong></div>' : '') +
            (cr.pulse ? '<div><div class="text-xs text-muted">Pulse · 脈診</div><strong>' + esc(cr.pulse) + '</strong></div>' : '') +
          '</div>'
        : '') +

      // Case fields (every one rendered with 'not recorded' fallback)
      f('Chief Complaint', '主訴',         cr.chief_complaint) +
      f('Present Illness', '現病史',       cr.present_illness) +
      f('Past History',    '既往史',       cr.past_history) +
      f('TCM Pattern',     '中醫證型',     cr.pattern_diagnosis) +
      f('Western Dx',      '西醫診斷',     cr.western_diagnosis) +
      f('Treatment Principle', '治法治則', cr.treatment_principle) +
      f('Doctor Instructions', '醫囑',     cr.doctor_instructions) +

      // Body diagram — prefer body_combined (current save path);
      // fall back to legacy body_front + body_back when only those
      // exist on older rows.
      ((cr.body_combined || cr.body_front || cr.body_back)
        ? '<div style="margin-bottom:14px;">' +
            '<div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">Body Diagram · 身體圖示</div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
              (cr.body_combined
                ? '<a href="' + esc(cr.body_combined) + '" target="_blank" rel="noopener"><img src="' + esc(cr.body_combined) + '" style="height:200px;width:auto;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;"></a>'
                : (
                  (cr.body_front ? '<a href="' + esc(cr.body_front) + '" target="_blank" rel="noopener"><img src="' + esc(cr.body_front) + '" style="height:200px;width:auto;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;"><div class="text-xs text-muted text-center mt-1">Front · 正面</div></a>' : '') +
                  (cr.body_back  ? '<a href="' + esc(cr.body_back)  + '" target="_blank" rel="noopener"><img src="' + esc(cr.body_back)  + '" style="height:200px;width:auto;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;"><div class="text-xs text-muted text-center mt-1">Back · 背面</div></a>' : '')
                )
              ) +
            '</div>' +
          '</div>'
        : '') +

      // Body marks
      (bodyMarks.length
        ? '<div style="margin-bottom:14px;"><div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">Body Marks · 標記</div>' +
          '<div style="font-size:13px;">' + bodyMarks.length + ' point(s) — ' +
          bodyMarks.map(function (m) { return esc(m && (m.label || m.note) || ''); }).filter(Boolean).join(', ') +
          '</div></div>'
        : '') +

      // Documents
      (docs.length
        ? '<div style="margin-bottom:14px;"><div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">Documents · 文件</div>' +
          '<ul style="list-style:none;padding:0;margin:0;">' +
            docs.map(function (d) {
              if (!d) return '';
              var href = d.url || d.dataUrl || '';
              var name = d.name || d.filename || 'document';
              var size = d.size ? ' · ' + Math.round(d.size / 1024) + ' KB' : '';
              return '<li class="text-sm mt-1">📎 ' + (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener" style="color:var(--gold);">' + esc(name) + '</a>' : esc(name)) + '<span class="text-muted">' + size + '</span></li>';
            }).join('') +
          '</ul></div>'
        : '') +

      // Treatments
      (treatments.length
        ? '<div style="margin-bottom:14px;padding:12px 14px;background:rgba(122,140,114,0.08);border-radius:var(--r-sm);border-left:3px solid var(--sage);">' +
          '<div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">💉 Treatments · 治療 (' + treatments.length + ')</div>' +
          treatments.map(function (t) {
            return '<div class="text-sm mt-1">' + (t.icon || '•') + ' <strong>' + esc(t.name || t.key || '') + '</strong>' +
              (t.name_zh ? ' · ' + esc(t.name_zh) : '') +
              (t.points && t.points.length ? '<div class="text-xs text-muted">Points · 穴位: ' + t.points.map(esc).join(', ') + '</div>' : '') +
              (t.duration_min ? '<span class="text-xs text-muted"> · ' + t.duration_min + ' min</span>' : '') +
              (t.fee ? '<span class="text-xs text-muted"> · RM ' + t.fee + '</span>' : '') +
              (t.notes ? '<div class="text-xs text-muted">' + esc(t.notes) + '</div>' : '') +
            '</div>';
          }).join('') +
          '</div>'
        : '') +

      // Prescription
      ((rx.diagnosis || rxItems.length)
        ? '<div style="margin-bottom:14px;padding:12px 14px;background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);">' +
          '<div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">💊 Prescription · 處方</div>' +
          (rx.diagnosis ? '<div class="text-sm"><strong>Dx:</strong> ' + esc(rx.diagnosis) + '</div>' : '') +
          (rx.instructions ? '<div class="text-sm mt-1"><strong>Instructions:</strong> ' + esc(rx.instructions) + '</div>' : '') +
          (rxItems.length
            ? '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">' +
                rxItems.map(function (it) {
                  return '<span style="background:var(--washi);padding:3px 10px;border-radius:999px;border:1px solid var(--border);font-size:12px;">' +
                    esc(it.drug_name || '') + ' ' + (it.quantity || '') + (it.unit || 'g') +
                  '</span>';
                }).join('') +
              '</div>'
            : '') +
          '</div>'
        : '');

    HM.ui.modal({
      size:    'lg',
      title:   '📄 Case Record · 病歷詳情',
      content: content,
    });
  }

  // ── Modal: Single tongue assessment with full AI report ──
  function openTongueDetailModal(patient, t) {
    var report = t.constitution_report || {};
    var cons   = report.constitution || {};
    var dims   = Array.isArray(report.dimensions) ? report.dimensions : [];
    var findings = Array.isArray(report.findings) ? report.findings : [];
    var alerts   = Array.isArray(report.alerts)   ? report.alerts   : [];
    var recs     = Array.isArray(report.recommendations) ? report.recommendations : [];

    var thumb = t.image_url
      ? '<img src="' + HM.format.esc(t.image_url) + '" style="max-width:100%;height:auto;max-height:280px;border-radius:var(--r-md);border:1px solid var(--border);">'
      : '<div style="height:120px;background:var(--washi);border:1px dashed var(--border);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;color:var(--mu);">📷 Photo no longer available · 照片已不可用</div>';

    var dimRows = dims.map(function (d) {
      var v = parseInt(d.score, 10);
      var color = v > 0 ? '#a16207' : v < 0 ? '#3F6594' : '#7a7468';
      return '<tr>' +
        '<td style="padding:4px 8px;font-size:13px;">' + HM.format.esc(d.label_en || d.key || '') + ' · ' + HM.format.esc(d.label_zh || '') + '</td>' +
        '<td style="padding:4px 8px;text-align:right;color:' + color + ';font-weight:500;font-family:var(--font-mono);">[' + (v > 0 ? '+' + v : v) + ']</td>' +
      '</tr>';
    }).join('');

    var content =
      '<div style="margin-bottom:14px;font-size:13px;color:var(--mu);">' +
        HM.format.datetime(t.created_at) + ' · Score: <strong>' + (t.health_score || '—') + '/100</strong>' +
      '</div>' +
      '<div style="margin-bottom:18px;">' + thumb + '</div>' +

      (cons.name_en
        ? '<div style="padding:12px 14px;background:var(--washi);border-radius:var(--r-sm);margin-bottom:14px;">' +
            '<div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Constitution · 體質</div>' +
            '<div style="font-size:16px;font-weight:600;color:var(--ink);">' + HM.format.esc(cons.name_en) + (cons.name_zh ? ' · ' + HM.format.esc(cons.name_zh) : '') + '</div>' +
            (cons.description ? '<div class="text-sm mt-1" style="line-height:1.6;">' + HM.format.esc(cons.description) + '</div>' : '') +
          '</div>'
        : '') +

      (dimRows
        ? '<div style="margin-bottom:14px;">' +
            '<div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">Dimensions · 維度</div>' +
            '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;">' +
              '<tbody>' + dimRows + '</tbody>' +
            '</table>' +
          '</div>'
        : '') +

      (findings.length
        ? '<div style="margin-bottom:14px;"><div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">Findings · 發現</div>' +
          '<ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.7;">' +
            findings.map(function (f) { return '<li>' + HM.format.esc(typeof f === 'string' ? f : (f.text || f.finding || '')) + '</li>'; }).join('') +
          '</ul></div>'
        : '') +

      (alerts.length
        ? '<div class="alert alert--danger" style="margin-bottom:14px;"><div class="alert-body text-sm">' +
            '<strong>⚠️ Safety Alerts</strong><br>' +
            alerts.map(function (a) { return '• ' + HM.format.esc(a && (a.alert || a.text) || ''); }).join('<br>') +
          '</div></div>'
        : '') +

      (recs.length
        ? '<div style="margin-bottom:14px;"><div class="text-xs text-muted" style="font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">Recommendations · 建議</div>' +
          '<ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.7;">' +
            recs.map(function (r) { return '<li>' + HM.format.esc(typeof r === 'string' ? r : (r.text || r.recommendation || '')) + '</li>'; }).join('') +
          '</ul></div>'
        : '') +

      (t.review_status
        ? '<div class="text-xs text-muted">Review: ' + HM.format.esc(t.review_status) + (t.reviewer_doctor_id ? ' (doctor #' + t.reviewer_doctor_id + ')' : '') + '</div>'
        : '');

    HM.ui.modal({
      size:    'lg',
      title:   '👅 Tongue Assessment · 舌診報告',
      content: content,
    });
  }

  // ── Modal: All tongue + wellness history ──
  // Lists every tongue assessment in reverse-chronological order with
  // small thumbnails + headline scores. Click any row to drill into
  // openTongueDetailModal for the full report.
  function openTongueHistoryModal(patient, tongues) {
    if (! tongues.length) {
      HM.ui.modal({
        size:    'md',
        title:   '👅 AI Wellness History · 健康評估記錄',
        content: '<p class="text-muted">No tongue assessments on file yet for this patient · 暫無記錄</p>',
      });
      return;
    }

    var rows = tongues.map(function (t) {
      var c = (t.constitution_report && t.constitution_report.constitution) || {};
      var thumb = t.image_url
        ? '<img src="' + HM.format.esc(t.image_url) + '" style="width:64px;height:64px;object-fit:cover;border-radius:var(--r-sm);border:1px solid var(--border);">'
        : '<div style="width:64px;height:64px;background:var(--washi);border:1px dashed var(--border);border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;color:var(--mu);font-size:18px;">📷</div>';
      return '<div onclick="HM.doctorPanels.patients._viewTongue(' + patient.id + ',' + t.id + ')" ' +
        'style="display:flex;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:8px;cursor:pointer;transition:all 0.15s;background:#fff;" ' +
        'onmouseenter="this.style.borderColor=\'var(--gold)\';this.style.transform=\'translateY(-1px)\';" ' +
        'onmouseleave="this.style.borderColor=\'var(--border)\';this.style.transform=\'\';">' +
        thumb +
        '<div style="flex:1;min-width:0;">' +
          '<div class="text-xs text-muted">' + HM.format.datetime(t.created_at) + '</div>' +
          '<div class="text-sm" style="font-weight:600;color:var(--ink);">' + HM.format.esc(c.name_en || 'Analysis') + (c.name_zh ? ' · ' + HM.format.esc(c.name_zh) : '') + '</div>' +
          '<div class="text-xs text-muted">Score: ' + (t.health_score || '—') + '/100' +
          (t.review_status ? ' · ' + HM.format.esc(t.review_status) : '') +
          '</div>' +
        '</div>' +
        '<div class="text-xs text-muted">→</div>' +
      '</div>';
    }).join('');

    HM.ui.modal({
      size:    'lg',
      title:   '👅 AI Wellness History · 健康評估記錄 (' + tongues.length + ')',
      content:
        '<p class="text-xs text-muted mb-3">Click any row for the full AI report — constitution analysis, dimension scores, findings, recommendations.</p>' +
        rows,
    });
  }
})();
