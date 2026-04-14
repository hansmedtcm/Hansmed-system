/**
 * Doctor Help
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Help Center · 幫助中心</div>' +
      '<h1 class="page-title">Doctor Support</h1>' +
      '</div>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--s-4);">' +
      card('📋', 'Starting Consultations', '開始問診', 'Go to Today\'s Queue → click Start Consult on a patient. Video opens with notes and prescription pad on the side.') +
      card('📝', 'Issuing Prescriptions', '開立處方', 'During consultation, add drug items to prescription pad. Click Complete & Issue Rx to finalize. You can revise or revoke later.') +
      card('⏰', 'Setting Your Schedule', '設定排班', 'Go to Schedule → add your weekly availability. Patients can only book in your open slots.') +
      card('💰', 'Getting Paid', '收款', 'Earnings accrue as patients complete consultations. Request withdrawal when balance is available (platform fee 15%).') +
      card('💬', 'Messaging Patients', '患者對話', 'From Patient List → click Chat. Useful for follow-up questions between consultations.') +
      card('📄', 'Generating Documents', '開立文件', 'Medical certificates and referral letters can be generated from the Documents page.') +
      card('📞', 'Contact Support', '聯絡客服', '📧 ' + HM.config.CLINIC.email + '<br>📞 ' + HM.config.CLINIC.phone) +
      '</div>';
  }

  function card(icon, t, tz, body) {
    return '<div class="card"><div style="font-size:2rem;margin-bottom:var(--s-3);">' + icon + '</div>' +
      '<div class="card-title">' + t + '</div>' +
      '<div class="text-sm text-muted" style="font-family: var(--font-zh); margin-bottom: var(--s-2);">' + tz + '</div>' +
      '<p class="text-sm text-muted" style="line-height: var(--leading-relaxed);">' + body + '</p></div>';
  }

  HM.doctorPanels.help = { render: render };
})();
