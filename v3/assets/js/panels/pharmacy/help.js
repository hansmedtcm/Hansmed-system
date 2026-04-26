/**
 * Pharmacy Help
 */
(function () {
  'use strict';
  HM.pharmPanels = HM.pharmPanels || {};

  function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Help · 幫助</div>' +
      '<h1 class="page-title">Pharmacy Support</h1>' +
      '</div>' +
      '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--s-4);">' +
      card('📦', 'Fulfilling Orders', '配藥流程', 'Orders tab → Start Dispensing → prepare items → Mark Dispensed → enter carrier and tracking → Ship.') +
      card('💊', 'Managing Inventory', '管理庫存', 'Products tab → + Add Product. Use ± Stock to adjust quantities. Low stock warning appears when below reorder threshold.') +
      card('🧾', 'POS Operations', '收銀操作', 'POS tab → click products → choose payment method (cash/card/e-wallet) → Complete Sale. Receipt opens for printing.') +
      card('💰', 'Finance & Payouts', '財務提現', 'Finance tab shows monthly breakdown. Platform fee is 8%. Daily reconciliation shows per-day revenue.') +
      card('📋', 'Prescription Inbox', '處方收件箱', 'Inbox shows all prescriptions attached to your orders with diagnosis, drug list, and doctor instructions.') +
      card('📞', 'Contact Support', '聯絡客服', '📧 ' + HM.config.CLINIC.email + '<br>📞 ' + HM.config.CLINIC.phone) +
      '</div>';
  }

  function card(icon, t, tz, body) {
    return '<div class="card"><div style="font-size:2rem;margin-bottom:var(--s-3);">' + icon + '</div>' +
      '<div class="card-title">' + t + '</div>' +
      '<div class="text-sm text-muted" style="font-family: var(--font-zh); margin-bottom: var(--s-2);">' + tz + '</div>' +
      '<p class="text-sm text-muted" style="line-height: var(--leading-relaxed);">' + body + '</p></div>';
  }

  HM.pharmPanels.help = { render: render };
})();
