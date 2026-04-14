/**
 * HansMed i18n — EN/ZH translation layer.
 * Minimal; most labels are hardcoded bilingual (EN · ZH) inline per the TCM aesthetic.
 */
(function () {
  'use strict';

  window.HM = window.HM || {};
  var cfg = window.HM.config;

  var dict = {
    en: {
      welcome: 'Welcome',
      loading: 'Loading…',
      error: 'Error',
      retry: 'Retry',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      signin: 'Sign In',
      signup: 'Sign Up',
      signout: 'Sign Out',
      required: 'Required',
    },
    zh: {
      welcome: '歡迎',
      loading: '載入中…',
      error: '錯誤',
      retry: '重試',
      save: '儲存',
      cancel: '取消',
      confirm: '確認',
      signin: '登入',
      signup: '註冊',
      signout: '登出',
      required: '必填',
    },
  };

  function currentLang() {
    return localStorage.getItem(cfg.STORAGE.lang) || cfg.DEFAULT_LANG;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'zh') return;
    localStorage.setItem(cfg.STORAGE.lang, lang);
    document.documentElement.setAttribute('lang', lang);
    // Update any [data-i18n] attributes on the page
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    window.dispatchEvent(new CustomEvent('hm:lang-changed', { detail: { lang: lang } }));
  }

  function t(key) {
    var lang = currentLang();
    return (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || key;
  }

  window.HM.i18n = {
    t: t,
    setLang: setLang,
    currentLang: currentLang,
  };
})();
