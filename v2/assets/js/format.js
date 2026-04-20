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

  /**
   * Extract a human-friendly patient label from any object that
   * carries patient data — appointments, prescriptions, orders,
   * chat threads, review queue rows. Falls back through the common
   * shapes we return from the backend (eager-loaded relation, flat
   * joined columns, or nothing at all).
   *
   *   HM.format.patientLabel(appt)  → "Sarah Tan"
   *   HM.format.patientLabel(rx)    → "Lee Chee Meng"
   *   HM.format.patientLabel(order) → "Patient #5"  (if no data)
   */
  function patientLabel(o) {
    if (!o) return '';
    // Nested Eloquent relation shape
    if (o.patient && o.patient.patient_profile && o.patient.patient_profile.full_name) return o.patient.patient_profile.full_name;
    if (o.patient_profile && o.patient_profile.full_name) return o.patient_profile.full_name;
    // Flat joined columns (admin / pharmacy raw queries)
    if (o.patient_name) return o.patient_name;
    if (o.patient_full_name) return o.patient_full_name;
    // Email fallback before giving up entirely
    if (o.patient && o.patient.email) return o.patient.email;
    if (o.patient_email) return o.patient_email;
    if (o.patient_id) return 'Patient #' + o.patient_id;
    return '—';
  }

  /** Same for doctor labels — used on patient + pharmacy + admin side. */
  function doctorLabel(o, prefix) {
    prefix = prefix == null ? 'Dr. ' : prefix;
    if (!o) return '';
    if (o.doctor && o.doctor.doctor_profile && o.doctor.doctor_profile.full_name) return prefix + o.doctor.doctor_profile.full_name;
    if (o.doctor_profile && o.doctor_profile.full_name) return prefix + o.doctor_profile.full_name;
    if (o.doctor_name) return prefix + o.doctor_name;
    if (o.doctor && o.doctor.email) return prefix + o.doctor.email;
    if (o.doctor_email) return prefix + o.doctor_email;
    if (o.doctor_id) return 'Doctor #' + o.doctor_id;
    return '—';
  }

  /**
   * Produce an <img> tag with a graceful fallback if the URL 404s.
   * On Railway the storage volume is ephemeral — uploads vanish on
   * every deploy — so we get broken-image icons all over the place.
   * This wraps the image so the card renders a neutral placeholder
   * icon + washi background instead.
   *
   * Usage:
   *   HM.format.img(url, {
   *     style: 'width:70px;height:70px;border-radius:var(--r-md);',
   *     icon: '👅',            // shown in the placeholder
   *     title: 'Photo unavailable',
   *   })
   */
  function img(url, opts) {
    opts = opts || {};
    var icon = opts.icon || '📄';
    var baseStyle = opts.style || 'width:70px;height:70px;border-radius:var(--r-md);';
    var title = opts.title || 'Photo unavailable · 圖片不存在';
    // Placeholder HTML — built as a string so we can inject via outerHTML.
    var placeholder =
      '<div style="' + baseStyle +
      'object-fit:cover;background:var(--washi);display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--stone);" ' +
      'title="' + esc(title) + '">' + icon + '</div>';
    if (! url) return placeholder;
    var safe = esc(url);
    // JSON-stringify to produce a properly-quoted JS string for the
    // inline onerror handler. This keeps the HTML itself single-line.
    var replacement = JSON.stringify(placeholder);
    return '<img src="' + safe + '" ' +
      'loading="lazy" ' +
      'onerror="this.outerHTML=' + esc(replacement).replace(/"/g, '&quot;') + ';" ' +
      'style="' + baseStyle + 'object-fit:cover;background:var(--washi);">';
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
    patientLabel: patientLabel,
    doctorLabel: doctorLabel,
    img: img,
  };
})();
