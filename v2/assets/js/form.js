/**
 * HansMed Forms
 * Validation, serialization, error display.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};

  /** Serialize a form to plain object */
  function serialize(formEl) {
    var data = {};
    formEl.querySelectorAll('[name]').forEach(function (el) {
      var name = el.getAttribute('name');
      var val = el.type === 'checkbox' ? el.checked :
                el.type === 'number' ? (el.value ? parseFloat(el.value) : null) :
                el.value;
      data[name] = val;
    });
    return data;
  }

  /** Reset all error states on a form */
  function clearErrors(formEl) {
    formEl.querySelectorAll('.field.is-error').forEach(function (f) {
      f.classList.remove('is-error');
      var err = f.querySelector('.field-error');
      if (err) err.textContent = '';
    });
  }

  /** Show server validation errors on a form */
  function showErrors(formEl, errors) {
    clearErrors(formEl);
    if (!errors || typeof errors !== 'object') return;
    Object.keys(errors).forEach(function (name) {
      var input = formEl.querySelector('[name="' + name + '"]');
      if (!input) return;
      var field = input.closest('.field');
      if (!field) return;
      field.classList.add('is-error');
      var errEl = field.querySelector('.field-error');
      if (errEl) errEl.textContent = Array.isArray(errors[name]) ? errors[name][0] : errors[name];
    });
  }

  /** Show a general error (not field-specific) */
  function showGeneralError(formEl, message) {
    var general = formEl.querySelector('[data-general-error]');
    if (general) {
      general.textContent = message;
      general.style.display = 'block';
    }
  }

  function clearGeneralError(formEl) {
    var general = formEl.querySelector('[data-general-error]');
    if (general) {
      general.textContent = '';
      general.style.display = 'none';
    }
  }

  /** Client-side validate */
  function validate(formEl, rules) {
    clearErrors(formEl);
    var errors = {};
    Object.keys(rules || {}).forEach(function (name) {
      var input = formEl.querySelector('[name="' + name + '"]');
      if (!input) return;
      var val = input.type === 'checkbox' ? input.checked : (input.value || '').trim();
      var fieldRules = rules[name];
      for (var i = 0; i < fieldRules.length; i++) {
        var rule = fieldRules[i];
        if (rule === 'required') {
          if (!val) { errors[name] = ['This field is required']; break; }
        } else if (rule === 'email') {
          if (val && val.indexOf('@') < 0) { errors[name] = ['Enter a valid email']; break; }
        } else if (rule.indexOf('min:') === 0) {
          var min = parseInt(rule.substring(4));
          if (val.length < min) { errors[name] = ['Minimum ' + min + ' characters']; break; }
        }
      }
    });
    if (Object.keys(errors).length) {
      showErrors(formEl, errors);
      return false;
    }
    return true;
  }

  /** Show loading state on submit button */
  function setLoading(formEl, loading) {
    var btn = formEl.querySelector('button[type="submit"]');
    if (!btn) return;
    if (loading) {
      btn.classList.add('is-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  }

  window.HM.form = {
    serialize: serialize,
    validate: validate,
    clearErrors: clearErrors,
    showErrors: showErrors,
    showGeneralError: showGeneralError,
    clearGeneralError: clearGeneralError,
    setLoading: setLoading,
  };
})();
