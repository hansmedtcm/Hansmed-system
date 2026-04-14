/**
 * HansMed UI Primitives
 * Toast, modal, drawer, confirm, prompt.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  // ── TOAST ──
  var toastContainer = null;
  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      toastContainer.setAttribute('role', 'status');
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function toast(message, type, duration) {
    var container = ensureToastContainer();
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.textContent = message;
    container.appendChild(el);

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity 300ms';
      setTimeout(function () { el.remove(); }, 300);
    }, duration || 3000);
  }

  // ── MODAL ──
  function modal(options) {
    options = options || {};
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modalEl = document.createElement('div');
    modalEl.className = 'modal' + (options.size ? ' modal--' + options.size : '');
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');

    var closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = close;
    modalEl.appendChild(closeBtn);

    if (options.title) {
      var header = document.createElement('div');
      header.className = 'modal-header';
      header.innerHTML = '<div class="modal-title">' + options.title + '</div>' +
        (options.subtitle ? '<div class="modal-subtitle">' + options.subtitle + '</div>' : '');
      modalEl.appendChild(header);
    }

    var body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof options.content === 'string') body.innerHTML = options.content;
    else if (options.content instanceof Node) body.appendChild(options.content);
    modalEl.appendChild(body);

    backdrop.appendChild(modalEl);
    backdrop.onclick = function (e) {
      if (e.target === backdrop && options.dismissible !== false) close();
    };

    function close() {
      backdrop.style.opacity = '0';
      modalEl.style.transform = 'translateY(20px)';
      setTimeout(function () {
        backdrop.remove();
        if (options.onClose) options.onClose();
      }, 200);
    }

    // Escape key
    var escHandler = function (e) {
      if (e.key === 'Escape' && options.dismissible !== false) {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(backdrop);
    return { close: close, element: modalEl, body: body };
  }

  // ── CONFIRM ──
  function confirm(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var html = '<p class="mb-6">' + message + '</p>' +
        '<div class="flex flex-gap-3" style="justify-content:flex-end;">' +
        '<button class="btn btn--ghost" data-action="cancel">' + (options.cancelText || 'Cancel') + '</button>' +
        '<button class="btn btn--' + (options.danger ? 'danger' : 'primary') + '" data-action="confirm">' + (options.confirmText || 'Confirm') + '</button>' +
        '</div>';
      var m = modal({
        title: options.title || 'Confirm',
        content: html,
      });
      m.element.querySelector('[data-action="cancel"]').onclick = function () { m.close(); resolve(false); };
      m.element.querySelector('[data-action="confirm"]').onclick = function () { m.close(); resolve(true); };
    });
  }

  // ── PROMPT ──
  function prompt(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var html = '<p class="mb-4">' + message + '</p>' +
        '<input type="' + (options.type || 'text') + '" class="field-input field-input--boxed" data-input placeholder="' + (options.placeholder || '') + '" value="' + (options.defaultValue || '') + '">' +
        '<div class="flex flex-gap-3 mt-6" style="justify-content:flex-end;">' +
        '<button class="btn btn--ghost" data-action="cancel">Cancel</button>' +
        '<button class="btn btn--primary" data-action="confirm">OK</button>' +
        '</div>';
      var m = modal({
        title: options.title || 'Please enter',
        content: html,
      });
      var input = m.element.querySelector('[data-input]');
      setTimeout(function () { input.focus(); }, 50);
      m.element.querySelector('[data-action="cancel"]').onclick = function () { m.close(); resolve(null); };
      m.element.querySelector('[data-action="confirm"]').onclick = function () {
        var val = input.value.trim();
        if (options.required && !val) { input.focus(); return; }
        m.close();
        resolve(val);
      };
      input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') m.element.querySelector('[data-action="confirm"]').click();
      });
    });
  }

  // ── DRAWER ──
  function drawer(options) {
    options = options || {};
    var backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';

    var drawerEl = document.createElement('aside');
    drawerEl.className = 'drawer';
    drawerEl.setAttribute('role', 'dialog');

    if (options.content) {
      if (typeof options.content === 'string') drawerEl.innerHTML = options.content;
      else drawerEl.appendChild(options.content);
    }

    function close() {
      backdrop.style.opacity = '0';
      drawerEl.classList.remove('is-open');
      setTimeout(function () {
        backdrop.remove();
        drawerEl.remove();
      }, 250);
    }

    backdrop.onclick = close;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawerEl);
    setTimeout(function () { drawerEl.classList.add('is-open'); }, 10);

    return { close: close, element: drawerEl };
  }

  window.HM.ui = {
    toast: toast,
    modal: modal,
    confirm: confirm,
    prompt: prompt,
    drawer: drawer,
  };
})();
