/**
 * Doctor Messages — shares patient chat logic
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

  // Reuse patient messages panel logic
  HM.doctorPanels.messages = HM.patientPanels && HM.patientPanels.messages ?
    HM.patientPanels.messages :
    {
      render: function (el) {
        el.innerHTML = '<div class="page-header"><h1 class="page-title">Messages</h1></div>' +
          '<div class="state state--empty"><div class="state-icon">💬</div><div class="state-text">Loading chat module…</div></div>';
      }
    };
})();
