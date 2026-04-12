/**
 * HansMed Checkout — Malaysia Payment Methods
 * ---------------------------------------------
 * Stripe Malaysia supports: Cards, FPX, Touch 'n Go, GrabPay, ShopeePay.
 * This file handles the checkout flow from cart → payment → confirmation.
 */
(function () {
  'use strict';
  var A = window.HansMedAPI;
  if (!A) return;

  // Stripe publishable key — set in production
  var STRIPE_PK = window.HANSMED_STRIPE_PK || '';

  // ── Payment method selector UI ──
  function paymentMethodsHTML(amount) {
    return ''
      + '<div id="checkout-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;display:flex;align-items:center;justify-content:center;">'
      + '  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);" onclick="closeCheckout()"></div>'
      + '  <div style="position:relative;background:var(--cream);max-width:480px;width:90%;padding:2.5rem;border:1px solid var(--mist);max-height:90vh;overflow-y:auto;">'
      + '    <button onclick="closeCheckout()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--stone);">✕</button>'
      + '    <div style="text-align:center;margin-bottom:1.5rem;">'
      + '      <div style="font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);">Checkout · 結帳</div>'
      + '      <div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;color:var(--ink);margin-top:.5rem;">RM ' + parseFloat(amount).toFixed(2) + '</div>'
      + '    </div>'
      + '    <div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.8rem;">Select Payment Method · 選擇付款方式</div>'
      + '    <div id="checkout-methods">'
      + paymentOption('card', '💳', 'Credit / Debit Card', 'Visa, Mastercard, AMEX')
      + paymentOption('fpx', '🏦', 'FPX Online Banking', 'Maybank, CIMB, Public Bank, etc.')
      + paymentOption('grabpay', '🟢', 'GrabPay', 'Pay with Grab e-wallet')
      + paymentOption('touch_n_go', '🔵', 'Touch \'n Go eWallet', 'TNG eWallet')
      + paymentOption('shopeepay', '🟠', 'ShopeePay', 'Shopee e-wallet')
      + '    </div>'
      + '    <div id="checkout-card-form" style="display:none;margin-top:1rem;">'
      + '      <div id="stripe-card-element" style="padding:1rem;border:1px solid var(--mist);background:var(--washi);margin-bottom:1rem;min-height:40px;">Card form loads here when Stripe.js is connected</div>'
      + '    </div>'
      + '    <button id="checkout-pay-btn" class="btn-primary" style="width:100%;margin-top:1rem;padding:1rem;" onclick="processPayment()">Pay RM ' + parseFloat(amount).toFixed(2) + ' · 付款</button>'
      + '    <div id="checkout-status" style="text-align:center;margin-top:.8rem;font-size:.82rem;color:var(--stone);"></div>'
      + '    <div style="text-align:center;margin-top:1rem;font-size:.65rem;color:var(--stone);">Secured by Stripe · 支付由Stripe安全處理</div>'
      + '  </div>'
      + '</div>';
  }

  function paymentOption(method, icon, title, subtitle) {
    return '<div class="pay-method-opt" data-method="' + method + '" onclick="selectPayMethod(\'' + method + '\')" '
      + 'style="display:flex;align-items:center;gap:1rem;padding:1rem;border:1.5px solid var(--mist);margin-bottom:.5rem;cursor:pointer;transition:all .3s;">'
      + '<div style="font-size:1.4rem;width:2rem;text-align:center;">' + icon + '</div>'
      + '<div><div style="font-size:.92rem;color:var(--ink);">' + title + '</div>'
      + '<div style="font-size:.72rem;color:var(--stone);">' + subtitle + '</div></div>'
      + '<div style="margin-left:auto;width:18px;height:18px;border:2px solid var(--mist);border-radius:50%;transition:all .3s;" id="pay-radio-' + method + '"></div>'
      + '</div>';
  }

  var _selectedMethod = null;
  var _checkoutAmount = 0;
  var _checkoutType = null; // 'appointment' or 'order'
  var _checkoutId = null;

  window.selectPayMethod = function (method) {
    _selectedMethod = method;
    document.querySelectorAll('.pay-method-opt').forEach(function (el) {
      el.style.borderColor = 'var(--mist)';
      el.style.background = 'transparent';
    });
    var chosen = document.querySelector('[data-method="' + method + '"]');
    if (chosen) { chosen.style.borderColor = 'var(--gold)'; chosen.style.background = 'var(--washi)'; }
    // Radio dot
    document.querySelectorAll('[id^="pay-radio-"]').forEach(function (r) {
      r.style.background = 'transparent'; r.style.borderColor = 'var(--mist)';
    });
    var radio = document.getElementById('pay-radio-' + method);
    if (radio) { radio.style.background = 'var(--gold)'; radio.style.borderColor = 'var(--gold)'; }
    // Show card form for card method
    var cardForm = document.getElementById('checkout-card-form');
    if (cardForm) cardForm.style.display = method === 'card' ? 'block' : 'none';
  };

  window.processPayment = async function () {
    if (!_selectedMethod) { showToast('Please select a payment method · 請選擇付款方式'); return; }
    var statusEl = document.getElementById('checkout-status');
    var payBtn = document.getElementById('checkout-pay-btn');
    if (statusEl) statusEl.textContent = 'Processing... · 處理中...';
    if (payBtn) payBtn.disabled = true;

    // In production, this would create a Stripe PaymentIntent with the selected method
    // For now, simulate success after 2 seconds
    try {
      if (STRIPE_PK && window.Stripe) {
        // Real Stripe flow would go here
        // var stripe = Stripe(STRIPE_PK);
        // var res = await A.api.post('/api/payments/stripe/create', { ... });
        // await stripe.confirmPayment(...)
      }

      // Simulate payment processing
      await new Promise(function (resolve) { setTimeout(resolve, 2000); });

      if (statusEl) statusEl.innerHTML = '<span style="color:var(--sage);">✓ Payment successful! · 付款成功！</span>';
      showToast('Payment successful! · 付款成功！ ✓');

      setTimeout(function () {
        closeCheckout();
        if (_checkoutType === 'cart') {
          // Clear cart
          if (typeof window.cart !== 'undefined') { window.cart = []; if (typeof updateCartUI === 'function') updateCartUI(); }
        }
      }, 1500);
    } catch (e) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red-seal);">Payment failed. Please try again. · 付款失敗</span>';
      if (payBtn) payBtn.disabled = false;
    }
  };

  window.closeCheckout = function () {
    var modal = document.getElementById('checkout-modal');
    if (modal) modal.remove();
  };

  window.openCheckout = function (amount, type, id) {
    _checkoutAmount = amount;
    _checkoutType = type || 'cart';
    _checkoutId = id;
    _selectedMethod = null;
    // Remove existing modal
    closeCheckout();
    // Insert modal
    document.body.insertAdjacentHTML('beforeend', paymentMethodsHTML(amount));
  };

  // ── Override cart checkout button ──
  window.checkoutWithStripe = function () {
    if (!window.currentUser || !A.getToken()) {
      requireLogin('patient');
      return;
    }
    var total = 0;
    if (typeof getTotal === 'function') total = getTotal();
    else if (typeof window.cart !== 'undefined') {
      window.cart.forEach(function (item) { total += item.price * item.qty; });
    }
    if (total <= 0) { showToast('Cart is empty · 購物車為空'); return; }
    openCheckout(total, 'cart');
  };

  // Hook into existing checkout button if it exists
  var cartFooter = document.querySelector('.cart-footer');
  if (cartFooter) {
    var checkoutBtn = cartFooter.querySelector('button');
    if (checkoutBtn && !checkoutBtn.getAttribute('data-checkout-wired')) {
      checkoutBtn.setAttribute('data-checkout-wired', '1');
      checkoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        checkoutWithStripe();
      });
    }
  }

  console.log('[HansMed] Checkout (Malaysia payments) loaded');
})();
