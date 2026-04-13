/**
 * HansMed Admin — M-05, M-10, M-11, M-12
 * ------------------------------------------
 * Tongue diagnosis config, permissions, audit logs, content management.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Hook into admin panel switching ──
  var _origShowAdminPanel = window.showAdminPanel;
  window.showAdminPanel = async function (id, btn) {
    if (typeof _origShowAdminPanel === 'function') _origShowAdminPanel(id, btn);
    try {
      if (id === 'adm-tongue')       await loadTongueConfig();
      if (id === 'adm-permissions')  await loadPermissions();
      if (id === 'adm-auditlogs')    await loadAuditLogs();
      if (id === 'adm-content')      await loadContentPages();
    } catch {}
  };

  // ── Inject extra nav tabs into admin sidebar ──
  function injectAdminTabs() {
    var nav = document.querySelector('#page-admin .admin-nav, #page-admin [class*="admin-sidebar"]');
    if (!nav || document.getElementById('adm-tongue-btn')) return;

    var tabs = [
      { id: 'adm-tongue',      icon: '👅', label: 'Tongue Config · 舌診配置' },
      { id: 'adm-permissions',  icon: '🔐', label: 'Permissions · 權限管理' },
      { id: 'adm-auditlogs',   icon: '📜', label: 'Audit Logs · 操作日志' },
      { id: 'adm-content',      icon: '📝', label: 'Content · 內容管理' },
    ];

    tabs.forEach(function (t) {
      var btn = document.createElement('button');
      btn.id = t.id + '-btn';
      btn.className = 'admin-nav-item';
      btn.innerHTML = t.icon + ' ' + t.label;
      btn.onclick = function () { showAdminPanel(t.id, btn); };
      nav.appendChild(btn);

      var panel = document.createElement('div');
      panel.id = t.id;
      panel.className = 'admin-panel';
      panel.innerHTML = '<div style="color:var(--stone);padding:2rem;">Loading...</div>';
      var content = document.querySelector('#page-admin .admin-content');
      if (content) content.appendChild(panel);
    });
  }

  var _origShowPage = window.showPage;
  window.showPage = function (p) {
    if (typeof _origShowPage === 'function') _origShowPage(p);
    if (p === 'admin') setTimeout(injectAdminTabs, 200);
  };

  // ================================================================
  // M-05: TONGUE DIAGNOSIS CONFIG
  // ================================================================
  async function loadTongueConfig() {
    var el = document.getElementById('adm-tongue');
    if (!el) return;
    try {
      var res = await A.api.get('/admin/tongue-config');
      var c = res.configs || {};
      var kb = res.knowledge_base_summary || {};

      el.innerHTML = ''
        + '<h3>Tongue Diagnosis Configuration · 舌診配置</h3>'
        + '<div class="sub-label">Configure third-party API, report templates, and mapping rules · 配置第三方API、報告模板和映射規則</div>'
        // Knowledge base summary
        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem;margin:1.5rem 0;">'
        + statCard(kb.tongue_colors || 0, 'Tongue Colors · 舌色')
        + statCard(kb.tongue_coatings || 0, 'Coatings · 舌苔')
        + statCard(kb.constitution_types || 0, 'Constitutions · 體質')
        + statCard(kb.clinical_patterns || 0, 'Clinical Patterns · 臨床模式')
        + '</div>'
        // API config
        + sectionLabel('Third-Party API · 第三方API配置')
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">'
        + configField('tc-provider', 'Provider · 提供商', c.tongue_api_provider || '', 'e.g. claude-vision, custom-api')
        + configField('tc-url', 'API URL', c.tongue_api_url || '', 'https://api.example.com/analyze')
        + configField('tc-key', 'API Key', c.tongue_api_key || '', '(hidden)', 'password')
        + '</div>'
        // Report template
        + sectionLabel('Report Template · 報告模板')
        + configArea('tc-header', 'Report Header · 報告標題', c.tongue_report_header || 'HansMed TCM · AI Tongue Diagnosis Report')
        + configArea('tc-footer', 'Report Footer · 報告頁腳', c.tongue_report_footer || 'This report is for reference only. Please consult a qualified TCM practitioner.')
        + configArea('tc-disclaimer', 'Disclaimer · 免責聲明', c.tongue_report_disclaimer || 'AI-assisted analysis. Results should be confirmed by a licensed practitioner.')
        // Settings
        + sectionLabel('Settings · 設定')
        + '<div style="margin-bottom:1rem;"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;"><input type="checkbox" id="tc-autorec" ' + (c.tongue_auto_recommendations === 'true' ? 'checked' : '') + '> Auto-generate product recommendations · 自動生成產品推薦</label></div>'
        + '<button class="btn-primary" onclick="saveTongueConfig()">Save Configuration · 儲存配置</button>';
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load config</p>'; }
  }

  window.saveTongueConfig = async function () {
    try {
      await A.api.post('/admin/tongue-config', {
        tongue_api_provider: gv('tc-provider'),
        tongue_api_url: gv('tc-url'),
        tongue_api_key: gv('tc-key'),
        tongue_report_header: gv('tc-header'),
        tongue_report_footer: gv('tc-footer'),
        tongue_report_disclaimer: gv('tc-disclaimer'),
        tongue_auto_recommendations: document.getElementById('tc-autorec')?.checked ? 'true' : 'false',
      });
      showToast('Tongue config saved! · 舌診配置已儲存 ✓');
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // M-10: PERMISSION MANAGEMENT
  // ================================================================
  async function loadPermissions() {
    var el = document.getElementById('adm-permissions');
    if (!el) return;
    try {
      var res = await A.api.get('/admin/permissions');
      var perms = res.permissions || {};

      el.innerHTML = ''
        + '<h3>Permission Management · 權限管理</h3>'
        + '<div class="sub-label">Control what each role can access · 控制每個角色的訪問權限</div>'
        + renderRolePerms('doctor', 'Doctor · 醫師', perms.doctor || {})
        + renderRolePerms('pharmacy', 'Pharmacy · 藥房', perms.pharmacy || {})
        + renderRolePerms('admin', 'Admin · 管理員', perms.admin || {})
        + '<button class="btn-primary" style="margin-top:1.5rem;" onclick="savePermissions()">Save Permissions · 儲存權限</button>';
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load permissions</p>'; }
  }

  function renderRolePerms(role, label, perms) {
    var html = '<div style="margin:1.5rem 0;">'
      + '<div style="font-size:.78rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.6rem;border-bottom:1px solid var(--mist);padding-bottom:.3rem;">' + label + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;">';
    Object.keys(perms).forEach(function (key) {
      var checked = perms[key] ? 'checked' : '';
      var label = key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      html += '<label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;cursor:pointer;padding:.3rem;">'
        + '<input type="checkbox" class="perm-cb" data-role="' + role + '" data-key="' + key + '" ' + checked + '> ' + label
        + '</label>';
    });
    html += '</div></div>';
    return html;
  }

  window.savePermissions = async function () {
    var perms = {};
    document.querySelectorAll('.perm-cb').forEach(function (cb) {
      var role = cb.dataset.role;
      var key = cb.dataset.key;
      if (!perms[role]) perms[role] = {};
      perms[role][key] = cb.checked;
    });
    try {
      await A.api.post('/admin/permissions', { permissions: perms });
      showToast('Permissions saved! · 權限已儲存 ✓');
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // M-11: AUDIT LOGS
  // ================================================================
  async function loadAuditLogs(params) {
    var el = document.getElementById('adm-auditlogs');
    if (!el) return;
    try {
      var res = await A.api.get('/admin/audit-logs' + (params || ''));
      var logs = res.data || [];

      el.innerHTML = ''
        + '<h3>Audit Logs · 操作日志</h3>'
        + '<div class="sub-label">Track all administrative actions · 追蹤所有管理操作</div>'
        // Filters
        + '<div style="display:flex;gap:.5rem;margin:1rem 0;flex-wrap:wrap;">'
        + '  <input id="al-action" placeholder="Filter by action · 按操作篩選" style="padding:.4rem .6rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.82rem;">'
        + '  <input id="al-from" type="date" style="padding:.4rem .6rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.82rem;">'
        + '  <input id="al-to" type="date" style="padding:.4rem .6rem;border:1px solid var(--mist);background:var(--washi);outline:none;font-size:.82rem;">'
        + '  <button class="ph-btn" onclick="filterAuditLogs()">Filter · 篩選</button>'
        + '</div>'
        // Table
        + '<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid var(--mist);">'
        + '<th style="text-align:left;padding:.5rem;font-size:.65rem;letter-spacing:.1em;color:var(--gold);text-transform:uppercase;">Time</th>'
        + '<th style="text-align:left;padding:.5rem;font-size:.65rem;color:var(--gold);">User</th>'
        + '<th style="text-align:left;padding:.5rem;font-size:.65rem;color:var(--gold);">Action</th>'
        + '<th style="text-align:left;padding:.5rem;font-size:.65rem;color:var(--gold);">Target</th>'
        + '<th style="text-align:left;padding:.5rem;font-size:.65rem;color:var(--gold);">Details</th>'
        + '</tr></thead><tbody>'
        + (logs.length ? logs.map(function (l) {
            return '<tr style="border-bottom:1px solid var(--mist);">'
              + '<td style="padding:.5rem;font-size:.78rem;color:var(--stone);">' + formatDate(l.created_at) + '</td>'
              + '<td style="padding:.5rem;font-size:.78rem;">' + (l.user_email || '#' + l.user_id) + '</td>'
              + '<td style="padding:.5rem;"><span style="font-size:.7rem;padding:.15rem .4rem;border-radius:3px;background:var(--washi-dark);color:var(--ink);">' + l.action + '</span></td>'
              + '<td style="padding:.5rem;font-size:.78rem;color:var(--stone);">' + (l.target_type ? l.target_type + ' #' + l.target_id : '—') + '</td>'
              + '<td style="padding:.5rem;font-size:.72rem;color:var(--stone);max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + (l.payload ? truncate(l.payload, 60) : '—') + '</td>'
              + '</tr>';
          }).join('') : '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--stone);">No logs yet · 暫無日志</td></tr>')
        + '</tbody></table>'
        + (res.last_page > 1 ? '<div style="margin-top:1rem;text-align:center;font-size:.82rem;color:var(--stone);">Page ' + res.current_page + ' of ' + res.last_page + '</div>' : '');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load audit logs</p>'; }
  }

  window.filterAuditLogs = function () {
    var action = gv('al-action');
    var from = gv('al-from');
    var to = gv('al-to');
    var params = [];
    if (action) params.push('action=' + encodeURIComponent(action));
    if (from)   params.push('from=' + from);
    if (to)     params.push('to=' + to);
    loadAuditLogs(params.length ? '?' + params.join('&') : '');
  };

  // ================================================================
  // M-12: CONTENT MANAGEMENT
  // ================================================================
  async function loadContentPages() {
    var el = document.getElementById('adm-content');
    if (!el) return;
    try {
      var res = await A.api.get('/admin/content');
      var pages = res.pages || [];

      el.innerHTML = ''
        + '<h3>Content Management · 內容管理</h3>'
        + '<div class="sub-label">Edit site pages: privacy policy, terms, FAQ, help · 編輯網站頁面</div>'
        + '<button class="btn-primary" style="margin-bottom:1.5rem;" onclick="openContentEditor()">+ New Page · 新增頁面</button>'
        // Editor (hidden by default)
        + '<div id="content-editor" style="display:none;background:var(--washi);padding:1.5rem;margin-bottom:1.5rem;border:1px solid var(--mist);">'
        + '  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem;">'
        + '    <div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">Slug (URL path) *</label><input id="ce-slug" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;" placeholder="e.g. privacy-policy"></div>'
        + '    <div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">Title · 標題 *</label><input id="ce-title" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
        + '    <div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">Locale · 語言</label><select id="ce-locale" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;"><option value="en">English</option><option value="zh">中文</option><option value="ms">Malay</option></select></div>'
        + '  </div>'
        + '  <div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">Content (HTML) · 內容</label>'
        + '    <textarea id="ce-body" rows="10" style="width:100%;padding:.6rem;border:1px solid var(--mist);background:transparent;outline:none;resize:vertical;font-family:monospace;font-size:.82rem;"></textarea></div>'
        + '  <div style="margin-top:.8rem;display:flex;gap:.5rem;">'
        + '    <button class="btn-primary" onclick="saveContentPage()">Save Page · 儲存頁面</button>'
        + '    <button class="btn-outline" onclick="closeContentEditor()">Cancel · 取消</button>'
        + '  </div>'
        + '</div>'
        // Quick-create buttons for common pages
        + (pages.length === 0 ? '<div style="display:flex;gap:.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">'
          + '<button class="ph-btn-outline" onclick="createQuickPage(\'privacy-policy\',\'Privacy Policy · 隱私政策\')">+ Privacy Policy</button>'
          + '<button class="ph-btn-outline" onclick="createQuickPage(\'terms\',\'Terms of Service · 服務條款\')">+ Terms of Service</button>'
          + '<button class="ph-btn-outline" onclick="createQuickPage(\'faq\',\'FAQ · 常見問題\')">+ FAQ</button>'
          + '<button class="ph-btn-outline" onclick="createQuickPage(\'about\',\'About Us · 關於我們\')">+ About Us</button>'
          + '</div>' : '')
        // Page list
        + (pages.length ? pages.map(function (p) {
            return '<div style="background:var(--washi);border:1px solid var(--mist);padding:1rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;">'
              + '<div><div style="font-size:.95rem;color:var(--ink);">' + p.title + '</div>'
              + '<div style="font-size:.72rem;color:var(--stone);">/' + p.slug + ' · ' + p.locale + ' · Updated: ' + formatDate(p.updated_at) + '</div></div>'
              + '<div style="display:flex;gap:.4rem;">'
              + '<button class="ph-btn-outline" style="font-size:.65rem;" onclick="editContentPage(\'' + p.slug + '\')">Edit</button>'
              + '<button class="ph-btn-outline" style="font-size:.65rem;color:var(--red-seal);" onclick="deleteContentPage(\'' + p.slug + '\')">Delete</button>'
              + '</div></div>';
          }).join('') : '<p style="color:var(--stone);">No pages yet. Create your first page! · 暫無頁面</p>');
    } catch (e) { el.innerHTML = '<p style="color:var(--red-seal);">Failed to load content</p>'; }
  }

  window.openContentEditor = function () {
    document.getElementById('content-editor').style.display = 'block';
    document.getElementById('ce-slug').value = '';
    document.getElementById('ce-title').value = '';
    document.getElementById('ce-body').value = '';
    document.getElementById('ce-slug').disabled = false;
  };
  window.closeContentEditor = function () {
    document.getElementById('content-editor').style.display = 'none';
  };

  window.createQuickPage = function (slug, title) {
    document.getElementById('content-editor').style.display = 'block';
    document.getElementById('ce-slug').value = slug;
    document.getElementById('ce-title').value = title;
    document.getElementById('ce-body').value = '<h2>' + title + '</h2>\n<p>Content here...</p>';
  };

  window.editContentPage = async function (slug) {
    try {
      var res = await A.api.get('/admin/content/' + slug);
      var p = res.page;
      document.getElementById('content-editor').style.display = 'block';
      document.getElementById('ce-slug').value = p.slug;
      document.getElementById('ce-slug').disabled = true;
      document.getElementById('ce-title').value = p.title;
      document.getElementById('ce-body').value = p.body_html;
      if (p.locale) document.getElementById('ce-locale').value = p.locale;
    } catch (e) { showToast(e.message || 'Failed to load page'); }
  };

  window.saveContentPage = async function () {
    var slug = gv('ce-slug');
    var title = gv('ce-title');
    var body = gv('ce-body');
    if (!slug || !title || !body) { showToast('Slug, title and content required · 必填'); return; }
    try {
      await A.api.post('/admin/content', { slug: slug, title: title, body_html: body, locale: gv('ce-locale') || 'en' });
      showToast('Page saved! · 頁面已儲存 ✓');
      closeContentEditor();
      loadContentPages();
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  window.deleteContentPage = async function (slug) {
    if (!confirm('Delete page "' + slug + '"? · 確定刪除？')) return;
    try {
      await A.api.delete('/admin/content/' + slug);
      showToast('Page deleted · 頁面已刪除');
      loadContentPages();
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ── Helpers ──
  function sectionLabel(t) { return '<div style="font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:1.5rem 0 .6rem;border-bottom:1px solid var(--mist);padding-bottom:.3rem;">' + t + '</div>'; }
  function statCard(num, label) { return '<div class="ph-stat"><div class="ph-stat-num">' + num + '</div><div class="ph-stat-label">' + label + '</div></div>'; }
  function configField(id, label, value, placeholder, type) {
    return '<div><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '" placeholder="' + (placeholder || '') + '" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;font-size:.88rem;"></div>';
  }
  function configArea(id, label, value) {
    return '<div style="margin-bottom:.8rem;"><label style="display:block;font-size:.68rem;letter-spacing:.12em;color:var(--gold);text-transform:uppercase;margin-bottom:.3rem;">' + label + '</label>'
      + '<textarea id="' + id + '" rows="2" style="width:100%;padding:.5rem;border:1px solid var(--mist);background:var(--washi);outline:none;resize:vertical;font-size:.85rem;">' + esc(value) + '</textarea></div>';
  }
  function esc(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function truncate(s, n) { return s && s.length > n ? s.substring(0, n) + '...' : (s || ''); }
  function formatDate(s) { if (!s) return '—'; return new Date(s).toLocaleString('en-MY', { day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit' }); }

  console.log('[HansMed] Admin extras (M-05/10/11/12) loaded');
})();
