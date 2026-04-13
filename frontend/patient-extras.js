/**
 * HansMed Patient — C-07 compare/export, C-08 questionnaire save,
 * C-17 tracking UI, C-19 help, C-20 privacy/terms, C-21 account security
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // ── Hook into portal panels ──
  var _origShowPortalPanel = window.showPortalPanel;
  window.showPortalPanel = function (id, btn) {
    if (typeof _origShowPortalPanel === 'function') _origShowPortalPanel(id, btn);
    if (id === 'p-security') loadSecurity();
    if (id === 'p-help')     loadHelp();
  };

  // ================================================================
  // C-07: TONGUE COMPARE + EXPORT (enhance existing tongue history)
  // ================================================================
  // Add compare/export buttons to tongue history panel
  window.compareTongueScans = async function () {
    try {
      var res = await A.patient.listDiagnoses();
      var items = res.data || [];
      if (items.length < 2) { showToast('Need at least 2 scans to compare · 至少需要2次舌診才能比較'); return; }
      var a = items[0], b = items[1];

      var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;" onclick="this.remove()">'
        + '<div style="background:var(--cream);padding:2rem;max-width:800px;width:95%;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">'
        + '<h3>Tongue Scan Comparison · 舌診對比</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1rem;">'
        + compareCard(a, 'Latest · 最新')
        + compareCard(b, 'Previous · 上次')
        + '</div>'
        + '<div style="margin-top:1.5rem;text-align:center;"><button class="btn-outline" onclick="this.closest(\'div[style]\').remove()">Close · 關閉</button></div>'
        + '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  function compareCard(d, label) {
    var report = d.constitution_report || {};
    var constitution = report.constitution || {};
    return '<div style="background:var(--washi);border:1px solid var(--mist);padding:1rem;">'
      + '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem;">' + label + ' — ' + formatDate(d.created_at) + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;font-size:.82rem;">'
      + '<div>Color: <strong>' + (d.tongue_color || '—').replace(/_/g, ' ') + '</strong></div>'
      + '<div>Coating: <strong>' + (d.coating || '—').replace(/_/g, ' ') + '</strong></div>'
      + '<div>Shape: <strong>' + (d.shape || '—').replace(/_/g, ' ') + '</strong></div>'
      + '<div>Moisture: <strong>' + (d.moisture || '—') + '</strong></div>'
      + '<div>Teeth marks: ' + (d.teeth_marks ? '✓' : '✗') + '</div>'
      + '<div>Cracks: ' + (d.cracks ? '✓' : '✗') + '</div>'
      + '</div>'
      + '<div style="margin-top:.5rem;font-size:.92rem;">Score: <strong>' + (d.health_score || '—') + '</strong>/100</div>'
      + (constitution.name_en ? '<div style="font-size:.85rem;color:var(--sage);">' + constitution.name_en + '</div>' : '')
      + '</div>';
  }

  window.exportTongueReport = async function () {
    try {
      var res = await A.patient.listDiagnoses();
      var items = res.data || [];
      if (!items.length) { showToast('No scans to export · 無舌診記錄可匯出'); return; }
      // Generate CSV
      var csv = 'Date,Color,Coating,Shape,Teeth Marks,Cracks,Moisture,Score,Constitution\n';
      items.forEach(function (d) {
        var c = (d.constitution_report || {}).constitution || {};
        csv += [formatDate(d.created_at), d.tongue_color, d.coating, d.shape, d.teeth_marks ? 'Yes' : 'No', d.cracks ? 'Yes' : 'No', d.moisture, d.health_score, c.name_en || ''].join(',') + '\n';
      });
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'tongue-history.csv'; a.click();
      URL.revokeObjectURL(url);
      showToast('Exported! · 已匯出 ✓');
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // C-08: SAVE HEALTH QUESTIONNAIRE TO BACKEND
  // ================================================================
  var _origGenReport = window.genReport;
  window.genReport = function () {
    if (typeof _origGenReport === 'function') _origGenReport();
    // After generating report, save questionnaire answers to backend
    saveQuestionnaire();
  };

  async function saveQuestionnaire() {
    if (!A.getToken()) return;
    try {
      // Collect answers from the AI diagnosis page
      var answers = window._aiAnswers || [];
      await A.api.post('/patient/questionnaires', {
        symptoms: answers,
        lifestyle: [],
        diet: [],
        discomfort_areas: [],
      });
    } catch {}
  }

  // ================================================================
  // C-17: SHIPPING TRACKING UI
  // ================================================================
  // Enhance order detail to show tracking info
  window.trackOrder = async function (orderId) {
    try {
      var res = await A.patient.getOrder(orderId);
      var order = res.order || {};
      var shipment = order.shipment || {};

      var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;" onclick="this.remove()">'
        + '<div style="background:var(--cream);padding:2rem;max-width:500px;width:95%;" onclick="event.stopPropagation()">'
        + '<h3>Order Tracking · 物流追蹤</h3>'
        + '<div style="margin:1rem 0;">'
        + '<div style="font-size:.85rem;color:var(--stone);margin-bottom:.5rem;">Order: <strong>' + order.order_no + '</strong></div>'
        + '<div style="font-size:.85rem;color:var(--stone);margin-bottom:.5rem;">Status: <strong>' + (order.status || '—').replace(/_/g, ' ') + '</strong></div>'
        + (shipment.carrier ? '<div style="font-size:.85rem;">Carrier: <strong>' + shipment.carrier + '</strong></div>' : '')
        + (shipment.tracking_no ? '<div style="font-size:.85rem;">Tracking No: <strong>' + shipment.tracking_no + '</strong></div>' : '')
        + (shipment.shipped_at ? '<div style="font-size:.85rem;color:var(--sage);">Shipped: ' + formatDate(shipment.shipped_at) + '</div>' : '')
        + (shipment.delivered_at ? '<div style="font-size:.85rem;color:var(--sage);">Delivered: ' + formatDate(shipment.delivered_at) + '</div>' : '')
        + (!shipment.carrier ? '<div style="color:var(--stone);margin-top:1rem;">No shipping info yet. Your order is being prepared. · 訂單正在準備中。</div>' : '')
        + '</div>'
        + '<button class="btn-outline" onclick="this.closest(\'div[style]\').remove()">Close · 關閉</button>'
        + '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    } catch (e) { showToast(e.message || 'Failed'); }
  };

  // ================================================================
  // C-19: PATIENT HELP CENTER
  // ================================================================
  function loadHelp() {
    var el = document.getElementById('p-help');
    if (!el) return;
    el.innerHTML = ''
      + '<h3>Help Center · 幫助中心</h3>'
      + '<div class="sub-label">Common questions and guides · 常見問題與指南</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem;">'
      + helpCard('📋', 'How to book an appointment', '如何預約', 'Go to Book → Choose specialty → Select doctor → Pick date/time → Confirm → Pay.')
      + helpCard('👅', 'How to do a tongue scan', '如何進行舌診', 'Go to AI Diagnosis → Upload a clear photo of your tongue → AI analyzes and shows results.')
      + helpCard('💊', 'How to order medicine', '如何購藥', 'After consultation → View prescription → Select pharmacy → Confirm order → Pay → Track delivery.')
      + helpCard('💬', 'How to chat with your doctor', '如何與醫師聊天', 'After booking, open chat from your appointment or from the doctor\'s profile.')
      + helpCard('📹', 'How to join a video consultation', '如何加入視訊問診', 'At your appointment time, click "Join Video" — the doctor will connect with you.')
      + helpCard('🔒', 'How to change my password', '如何更改密碼', 'Go to Security tab → Enter current password → Enter new password → Save.')
      + helpCard('📦', 'How to track my order', '如何追蹤訂單', 'Go to Orders tab → Click on an order → View shipping carrier and tracking number.')
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

  // ================================================================
  // C-20: PRIVACY POLICY & TERMS
  // ================================================================
  window.showContentPage = async function (slug) {
    try {
      var res = await A.api.get('/pages/' + slug);
      var page = res.page;
      var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;" onclick="this.remove()">'
        + '<div style="background:var(--cream);padding:2rem;max-width:700px;width:95%;max-height:85vh;overflow-y:auto;" onclick="event.stopPropagation()">'
        + '<h2 style="animation:none;opacity:1;">' + page.title + '</h2>'
        + '<div style="margin:1rem 0;line-height:1.8;font-size:.92rem;color:var(--stone);">' + page.body_html + '</div>'
        + '<button class="btn-outline" onclick="this.closest(\'div[style]\').remove()">Close · 關閉</button>'
        + '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    } catch {
      showToast('Page not found · 頁面未找到');
    }
  };

  // Inject privacy/terms links into footer if they exist
  window.addEventListener('DOMContentLoaded', function () {
    var footer = document.querySelector('footer, #contact-sec');
    if (footer && !document.getElementById('legal-links')) {
      var links = document.createElement('div');
      links.id = 'legal-links';
      links.style.cssText = 'text-align:center;padding:1rem;font-size:.72rem;color:var(--stone);';
      links.innerHTML = '<a href="javascript:showContentPage(\'privacy-policy\')" style="color:var(--gold);text-decoration:none;margin:0 .5rem;">Privacy Policy · 隱私政策</a>'
        + '<a href="javascript:showContentPage(\'terms\')" style="color:var(--gold);text-decoration:none;margin:0 .5rem;">Terms of Service · 服務條款</a>'
        + '<a href="javascript:showContentPage(\'faq\')" style="color:var(--gold);text-decoration:none;margin:0 .5rem;">FAQ · 常見問題</a>';
      footer.parentNode.insertBefore(links, footer.nextSibling);
    }
  });

  // ================================================================
  // C-21: ACCOUNT SECURITY
  // ================================================================
  function loadSecurity() {
    var el = document.getElementById('p-security');
    if (!el) return;
    el.innerHTML = ''
      + '<h3>Account Security · 帳號安全</h3>'
      + '<div class="sub-label">Manage your password and account · 管理密碼與帳號</div>'
      // Change password
      + '<div style="background:var(--washi);border:1px solid var(--mist);padding:1.5rem;margin:1.5rem 0;">'
      + '<div style="font-size:.78rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:1rem;">Change Password · 更改密碼</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">'
      + '<div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">Current Password · 目前密碼</label><input id="sec-current" type="password" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
      + '<div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">New Password · 新密碼</label><input id="sec-new" type="password" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
      + '<div><label style="font-size:.68rem;color:var(--gold);text-transform:uppercase;">Confirm · 確認密碼</label><input id="sec-confirm" type="password" style="width:100%;padding:.5rem 0;border:none;border-bottom:1px solid var(--mist);background:transparent;outline:none;"></div>'
      + '</div>'
      + '<button class="btn-primary" style="margin-top:1rem;" onclick="changePassword()">Update Password · 更新密碼</button>'
      + '</div>'
      // Danger zone
      + '<div style="background:var(--washi);border:1px solid var(--red-seal);padding:1.5rem;margin-top:1.5rem;">'
      + '<div style="font-size:.78rem;letter-spacing:.15em;text-transform:uppercase;color:var(--red-seal);margin-bottom:.5rem;">Danger Zone · 危險區域</div>'
      + '<p style="font-size:.85rem;color:var(--stone);margin-bottom:1rem;">Deleting your account is permanent. All your data will be removed. · 刪除帳號為永久操作，所有資料將被移除。</p>'
      + '<button class="btn-outline" style="border-color:var(--red-seal);color:var(--red-seal);" onclick="deleteAccount()">Delete Account · 刪除帳號</button>'
      + '</div>';
  }

  window.changePassword = async function () {
    var current = gv('sec-current');
    var newPw = gv('sec-new');
    var confirm = gv('sec-confirm');
    if (!current || !newPw) { showToast('Fill in all fields · 請填寫所有欄位'); return; }
    if (newPw.length < 8) { showToast('New password must be at least 8 characters · 新密碼至少8個字元'); return; }
    if (newPw !== confirm) { showToast('Passwords do not match · 密碼不一致'); return; }
    try {
      await A.api.post('/auth/change-password', { current_password: current, new_password: newPw, new_password_confirmation: confirm });
      showToast('Password changed! · 密碼已更改 ✓');
      document.getElementById('sec-current').value = '';
      document.getElementById('sec-new').value = '';
      document.getElementById('sec-confirm').value = '';
    } catch (e) { showToast(e.data?.message || e.message || 'Failed'); }
  };

  window.deleteAccount = async function () {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.\n確定要刪除帳號嗎？此操作無法復原。')) return;
    var pw = prompt('Enter your password to confirm · 請輸入密碼確認:');
    if (!pw) return;
    try {
      await A.api.post('/auth/delete-account', { password: pw, confirm: 'DELETE' });
      showToast('Account deleted · 帳號已刪除');
      A.clearToken(); A.clearUser();
      setTimeout(function () { location.reload(); }, 1500);
    } catch (e) { showToast(e.data?.message || e.message || 'Failed'); }
  };

  // ── Helpers ──
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function formatDate(s) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-MY', { day:'numeric',month:'short',year:'numeric' }); }

  console.log('[HansMed] Patient extras (C-07/08/17/19/20/21) loaded');
})();
