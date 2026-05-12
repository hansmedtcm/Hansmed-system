/**
 * Help Center
 */
(function () {
  'use strict';
  HM.patientPanels = HM.patientPanels || {};

  function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Help Center · 幫助中心</div>' +
      '<h1 class="page-title">How Can We Help?</h1>' +
      '</div>' +

      '<div class="alert alert--danger mb-6">' +
      '<div class="alert-icon">⚠</div>' +
      '<div class="alert-body"><div class="alert-title">Medical Emergency</div>' +
      'For life-threatening emergencies, call <strong>999</strong> or visit the nearest hospital. HansMed is not for emergency care.' +
      '<br><span style="font-family: var(--font-zh);">如遇緊急醫療情況，請立即撥打 999 或前往最近的醫院。</span>' +
      '</div></div>' +

      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--s-4);">' +
      help('📋', 'Booking an Appointment', '預約流程', 'Go to Find Doctor → pick a practitioner → select date/time → pay. You\'ll get a confirmation and can join the video call at your appointment time.') +
      help('👅', 'Taking a Tongue Scan', '舌診步驟', 'Use natural lighting, no filters. Extend tongue fully in a relaxed state. Phone camera 1-2 feet away. Take scan in the morning before eating for best results.') +
      help('💊', 'Ordering Medicine', '購藥方法', 'After consultation, your doctor issues a prescription. Go to Prescriptions → select one → choose pharmacy → confirm delivery. Track shipping from Orders.') +
      help('💬', 'Chatting with Doctors', '與醫師對話', 'After your first consultation, you can message your doctor anytime with follow-up questions. Visit Messages to see all conversations.') +
      help('📹', 'Video Consultation', '視訊問診', 'At your appointment time, open your appointment detail → click Join Video. Allow camera and microphone access. Make sure you have a stable internet connection.') +
      help('🔒', 'Privacy & Security', '隱私安全', 'Your data is encrypted and stored securely. Profile can only be edited by admins after registration to prevent unauthorized changes. You can delete your account anytime in Settings.') +
      '</div>' +

      '<div class="card card--pad-lg mt-8" style="max-width: 600px; margin-left: auto; margin-right: auto;">' +
      '<h3 class="mb-3">Need Further Help? · 需要更多幫助？</h3>' +
      '<p class="text-sm text-muted mb-4">Our support team is ready to help with any questions.</p>' +
      '<div class="flex flex-col flex-gap-2">' +
      '<div>📧 <a href="mailto:' + HM.config.CLINIC.email + '">' + HM.config.CLINIC.email + '</a></div>' +
      '<div>📞 ' + HM.config.CLINIC.phone + '</div>' +
      '<div class="text-xs text-muted mt-2">Support hours: Mon-Fri 9am-6pm (Malaysia time)</div>' +
      '</div></div>';
  }

  function help(icon, title, titleZh, body) {
    return '<div class="card">' +
      '<div style="font-size: 2rem; margin-bottom: var(--s-3);">' + icon + '</div>' +
      '<div class="card-title">' + title + '</div>' +
      '<div class="text-sm text-muted" style="font-family: var(--font-zh); margin-bottom: var(--s-2);">' + titleZh + '</div>' +
      '<p class="text-sm text-muted" style="line-height: var(--leading-relaxed);">' + body + '</p>' +
      '</div>';
  }

  HM.patientPanels.help = { render: render };
})();
