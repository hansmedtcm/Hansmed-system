/**
 * HansMed Render
 * Template cloning + data binding. Replaces the need for React/Vue at our scale.
 *
 * Usage:
 *   <template id="tpl-appt">
 *     <div class="card" data-id="">
 *       <h3 data-bind="doctor_name"></h3>
 *       <span data-bind="scheduled_start" data-format="datetime"></span>
 *       <span data-bind="status" data-format="statusBadge" data-unsafe></span>
 *       <button data-action="cancel">Cancel</button>
 *     </div>
 *   </template>
 *
 *   HM.render.list(containerEl, appointments, 'tpl-appt', {
 *     onAction: function (action, id, e) { ... }
 *   });
 */
(function () {
  'use strict';

  window.HM = window.HM || {};
  var fmt = window.HM.format;

  function fromTemplate(tplId, data) {
    var tpl = document.getElementById(tplId);
    if (!tpl) {
      console.warn('[render] Template not found:', tplId);
      return document.createTextNode('');
    }
    var clone = tpl.content.cloneNode(true);
    bind(clone, data);
    return clone;
  }

  function bind(root, data) {
    if (!data) return root;

    // data-id
    var rootEl = root.firstElementChild;
    if (rootEl && data.id !== undefined) {
      rootEl.setAttribute('data-id', data.id);
    }

    // data-bind
    root.querySelectorAll('[data-bind]').forEach(function (el) {
      var key = el.getAttribute('data-bind');
      var val = resolve(data, key);
      var formatName = el.getAttribute('data-format');
      if (formatName && fmt[formatName]) {
        val = fmt[formatName](val);
      }
      if (el.hasAttribute('data-unsafe')) {
        el.innerHTML = val == null ? '' : String(val);
      } else {
        el.textContent = val == null ? '' : String(val);
      }
    });

    // data-bind-attr (e.g. data-bind-attr="src:avatar_url;alt:name")
    root.querySelectorAll('[data-bind-attr]').forEach(function (el) {
      el.getAttribute('data-bind-attr').split(';').forEach(function (pair) {
        var parts = pair.split(':');
        var attr = parts[0].trim();
        var key = parts[1].trim();
        var val = resolve(data, key);
        if (val != null) el.setAttribute(attr, val);
      });
    });

    // data-bind-class (show/hide based on truthy value)
    root.querySelectorAll('[data-bind-show]').forEach(function (el) {
      var key = el.getAttribute('data-bind-show');
      var val = resolve(data, key);
      if (!val) el.style.display = 'none';
    });
    root.querySelectorAll('[data-bind-hide]').forEach(function (el) {
      var key = el.getAttribute('data-bind-hide');
      var val = resolve(data, key);
      if (val) el.style.display = 'none';
    });

    return root;
  }

  function resolve(obj, path) {
    if (!obj) return null;
    if (path.indexOf('.') < 0) return obj[path];
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? null : acc[key];
    }, obj);
  }

  /**
   * Render a list into a container.
   * @param {Element} container
   * @param {Array} items
   * @param {string} tplId
   * @param {Object} opts - { onAction: (action, id, event) => void }
   */
  function list(container, items, tplId, opts) {
    if (!container) return;
    opts = opts || {};
    container.innerHTML = '';
    if (!items || items.length === 0) {
      if (opts.empty) {
        HM.state.empty(container, opts.empty);
      }
      return;
    }
    items.forEach(function (item) {
      var el = fromTemplate(tplId, item);
      // Wire data-action buttons
      el.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var action = btn.getAttribute('data-action');
          if (opts.onAction) opts.onAction(action, item.id, e, item);
        });
      });
      container.appendChild(el);
    });
  }

  window.HM.render = {
    fromTemplate: fromTemplate,
    bind: bind,
    list: list,
    resolve: resolve,
  };
})();
