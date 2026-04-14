/**
 * HansMed Formatting
 * Currency, date, status labels, etc.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  var statusLabels = {
    // Appointments
    pending_payment: { en: 'Pending Payment', zh: '待付款', class: 'pending' },
    confirmed:       { en: 'Confirmed', zh: '已確認', class: 'active' },
    in_progress:     { en: 'In Progress', zh: '進行中', class: 'progress' },
    completed:       { en: 'Completed', zh: '已完成', class: 'success' },
    cancelled:       { en: 'Cancelled', zh: '已取消', class: 'danger' },
    no_show:         { en: 'No Show', zh: '未到', class: 'danger' },

    // Prescriptions
    draft:     { en: 'Draft', zh: '草稿', class: '' },
    issued:    { en: 'Active', zh: '有效', class: 'active' },
    revised:   { en: 'Revised', zh: '已修改', class: 'info' },
    revoked:   { en: 'Revoked', zh: '已撤銷', class: 'danger' },
    dispensed: { en: 'Dispensed', zh: '已配藥', class: 'success' },

    // Orders
    paid:          { en: 'Paid', zh: '已付款', class: 'active' },
    dispensing:    { en: 'Dispensing', zh: '配藥中', class: 'progress' },
    shipped:       { en: 'Shipped', zh: '已寄出', class: 'info' },
    delivered:     { en: 'Delivered', zh: '已送達', class: 'success' },
    refunded:      { en: 'Refunded', zh: '已退款', class: 'danger' },
    after_sale:    { en: 'After Sale', zh: '售後', class: 'info' },

    // Users
    active:    { en: 'Active', zh: '有效', class: 'success' },
    pending:   { en: 'Pending', zh: '待審核', class: 'pending' },
    suspended: { en: 'Suspended', zh: '停用', class: 'danger' },
    deleted:   { en: 'Deleted', zh: '已刪除', class: 'danger' },

    // Verification
    approved: { en: 'Approved', zh: '已批准', class: 'success' },
    rejected: { en: 'Rejected', zh: '已拒絕', class: 'danger' },
  };

  function money(amount, currency) {
    var num = parseFloat(amount || 0);
    return (currency || 'RM') + ' ' + num.toFixed(2);
  }

  function moneyShort(amount) {
    var num = parseFloat(amount || 0);
    if (num >= 1000000) return 'RM ' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return 'RM ' + (num / 1000).toFixed(1) + 'K';
    return 'RM ' + num.toFixed(0);
  }

  function date(str, opts) {
    if (!str) return '—';
    var d = new Date(str);
    if (isNaN(d.getTime())) return '—';
    opts = opts || {};
    return d.toLocaleDateString('en-MY', {
      day: 'numeric',
      month: opts.short ? 'short' : 'short',
      year: 'numeric',
    });
  }

  function time(str) {
    if (!str) return '';
    var d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function datetime(str) {
    if (!str) return '—';
    return date(str) + ' · ' + time(str);
  }

  function relative(str) {
    if (!str) return '';
    var d = new Date(str);
    if (isNaN(d.getTime())) return '';
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
    return date(str);
  }

  function status(value, lang) {
    var s = statusLabels[value];
    if (!s) return value ? value.replace(/_/g, ' ') : '—';
    return lang === 'zh' ? s.zh : s.en;
  }

  function statusBadge(value, lang) {
    var s = statusLabels[value];
    var label = s ? (lang === 'zh' ? s.zh : s.en) : (value || '—').replace(/_/g, ' ');
    var cls = s && s.class ? 'badge--' + s.class : '';
    return '<span class="badge ' + cls + '">' + label + '</span>';
  }

  function truncate(str, n) {
    if (!str) return '';
    return str.length > n ? str.substring(0, n) + '…' : str;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function phone(num) {
    if (!num) return '';
    return num.replace(/[^\d+]/g, '').replace(/(\+60)(\d{2})(\d{3,4})(\d{4})/, '$1 $2-$3 $4');
  }

  function age(dob) {
    if (!dob) return '';
    var birth = new Date(dob);
    var diff = Date.now() - birth.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }

  window.HM.format = {
    money: money,
    moneyShort: moneyShort,
    date: date,
    time: time,
    datetime: datetime,
    relative: relative,
    status: status,
    statusBadge: statusBadge,
    truncate: truncate,
    esc: esc,
    phone: phone,
    age: age,
  };
})();
