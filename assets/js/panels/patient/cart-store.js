/**
 * HM.cart — simple localStorage-backed cart
 * Stores items: [{ id, name, name_zh, price, qty, emoji }]
 */
(function () {
  'use strict';
  window.HM = window.HM || {};
  var KEY = 'hm_cart';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (_) { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    if (HM.bus) HM.bus.emit('cart:changed', items);
  }

  function items() { return load(); }

  function count() {
    return load().reduce(function (s, it) { return s + (it.qty || 1); }, 0);
  }

  function subtotal() {
    return load().reduce(function (s, it) { return s + (it.price || 0) * (it.qty || 1); }, 0);
  }

  function add(product, qty) {
    qty = qty || 1;
    var cart = load();
    var existing = cart.find(function (it) { return String(it.id) === String(product.id); });
    if (existing) {
      existing.qty = (existing.qty || 1) + qty;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        name_zh: product.name_zh || '',
        price: Number(product.price) || 0,
        qty: qty,
        emoji: product.emoji || '🌿',
        pharmacy_id: product.pharmacy_id || null,
      });
    }
    save(cart);
  }

  function setQty(id, qty) {
    var cart = load();
    var idx = cart.findIndex(function (it) { return String(it.id) === String(id); });
    if (idx < 0) return;
    if (qty <= 0) cart.splice(idx, 1);
    else cart[idx].qty = qty;
    save(cart);
  }

  function remove(id) {
    var cart = load().filter(function (it) { return String(it.id) !== String(id); });
    save(cart);
  }

  function clear() {
    save([]);
  }

  HM.cart = {
    items: items,
    count: count,
    subtotal: subtotal,
    add: add,
    setQty: setQty,
    remove: remove,
    clear: clear,
  };
})();
