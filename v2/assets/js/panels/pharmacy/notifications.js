/**
 * Pharmacy Notifications — reuse doctor's
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};
  HM.pharmPanels.notifications = HM.doctorPanels && HM.doctorPanels.notifications || {
    render: function (el) { el.innerHTML = '<div class="state"><div class="state-text">Loading…</div></div>'; }
  };
})();
