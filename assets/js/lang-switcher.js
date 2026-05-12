/**
 * HansMed language switcher — runtime DOM bilingual toggle.
 *
 * Why this exists: the codebase was built bilingual-inline — "Profile ·
 * 個人資料" as a single text node rather than two translation keys.
 * A full i18n refactor would touch ~thousands of strings across every
 * panel. This module lets the existing markup keep working while
 * giving the user a real EN/中 toggle.
 *
 * Strategy:
 *   1. Apply body class `lang-en` or `lang-zh` based on preference.
 *   2. CSS rules hide Chinese-font spans when lang=en, hide English
 *      content when lang=zh.
 *   3. A DOM walker finds text nodes of the form "English · 中文" and
 *      wraps each half so CSS can target them.
 *   4. Walker runs on init + after every hashchange + on each
 *      setLang call. Uses a MutationObserver as backup for async
 *      re-renders.
 *
 * Adds a switcher pill to every page nav automatically.
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  // Heuristics for "is this a Chinese character":
  // - CJK Unified (\u4E00-\u9FFF)
  // - CJK Extension A (\u3400-\u4DBF)
  // - CJK Compatibility (\uF900-\uFAFF)
  var CJK_CHAR = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  // Match a full bilingual span like "Something · 中文" or
  // "English (short) · 中文說明". English half must contain at
  // least one latin letter (so we don't mis-wrap "12 · 5天" as
  // language pair). Chinese half must contain at least one CJK
  // character. Separator is ` · ` with surrounding whitespace.
  var BILINGUAL_SPLIT_RE = /^([^·\u00B7]*[a-zA-Z][^·\u00B7]*?)\s+[·\u00B7]\s+([^·\u00B7]*[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF][^·\u00B7]*)$/;

  var STORAGE_KEY = 'hm-lang-pref';

  function getLang() {
    var v = localStorage.getItem(STORAGE_KEY);
    return (v === 'zh' || v === 'en') ? v : 'en';
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'zh') return;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    document.body.classList.remove('lang-en', 'lang-zh');
    document.body.classList.add('lang-' + lang);
    // Reflect on any switcher pill so the active state updates.
    document.querySelectorAll('[data-lang-switch]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-lang-switch') === lang);
    });
    // Also reflect on any page-owned .lang-btn buttons (landing, settings).
    reflectActiveOnExistingSwitchers();
    // Rewalk the current DOM so mixed bilingual strings rewrap.
    walkAndWrap(document.body);
    // Also poke HM.i18n if present so data-i18n texts update too.
    if (window.HM && HM.i18n && HM.i18n.setLang) {
      try { HM.i18n.setLang(lang); } catch (_) {}
    }
  }

  /**
   * Walk text nodes under `root` and wrap any that match the
   * "English · 中文" pattern. Idempotent — nodes whose parent
   * already has the data-lang-wrapped attribute are skipped.
   */
  function walkAndWrap(root) {
    if (! root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        // Skip style/script nodes, tags we never want to touch, and
        // already-wrapped subtrees.
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-lang-wrapped]')) return NodeFilter.FILTER_REJECT;
        // CRITICAL: never wrap the language-switcher buttons. Their
        // text IS the language identifier (EN / 中) — wrapping "中"
        // in .hm-lang-zh would make the Chinese switch button
        // disappear when English is selected.
        if (p.closest('[data-lang], [data-lang-switch], .lang-btn, .lang-switcher, .hm-lang-pill')) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
        // Skip nodes whose parent is already a lang-wrapper.
        if (p.classList && (p.classList.contains('hm-lang-en') || p.classList.contains('hm-lang-zh'))) return NodeFilter.FILTER_REJECT;
        var t = n.nodeValue;
        if (!t || t.length < 3) return NodeFilter.FILTER_REJECT;
        if (! CJK_CHAR.test(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var nodes = [];
    var cur;
    while ((cur = walker.nextNode())) nodes.push(cur);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      // Try exact "English · 中文" form first.
      var m = BILINGUAL_SPLIT_RE.exec(text.trim());
      if (m) {
        var enHalf = m[1].trim();
        var zhHalf = m[2].trim();
        replaceWithWrappedPair(node, enHalf, zhHalf, text);
        return;
      }
      // Pure Chinese text (no English mixed in) — wrap the whole node
      // in hm-lang-zh so it hides when lang=en. Latin-only text is
      // left alone and shows in both modes by default.
      if (CJK_CHAR.test(text) && ! /[a-zA-Z]/.test(text)) {
        var span = document.createElement('span');
        span.className = 'hm-lang-zh';
        span.textContent = text;
        node.parentNode.replaceChild(span, node);
      }
    });

    // Also handle the common inline pattern
    // <span style="font-family: var(--font-zh);">中文</span> —
    // tag those as hm-lang-zh so the same CSS rule hides them.
    // This catches markup produced by the existing panel templates.
    // Skip anything inside a language switcher.
    root.querySelectorAll('[style*="font-zh"]').forEach(function (el) {
      if (el.closest('[data-lang], [data-lang-switch], .lang-btn, .lang-switcher, .hm-lang-pill')) return;
      if (! el.classList.contains('hm-lang-zh')) el.classList.add('hm-lang-zh');
    });
  }

  function replaceWithWrappedPair(textNode, enText, zhText, original) {
    var parent = textNode.parentNode;
    if (!parent) return;
    var frag = document.createDocumentFragment();
    var en = document.createElement('span');
    en.className = 'hm-lang-en';
    en.textContent = enText;
    frag.appendChild(en);
    // Preserve the "· " separator only so punctuation doesn't cling
    // oddly to whichever language is visible. Use a space that keeps
    // flow when both are hidden / shown.
    var sep = document.createElement('span');
    sep.className = 'hm-lang-sep';
    sep.textContent = ' · ';
    frag.appendChild(sep);
    var zh = document.createElement('span');
    zh.className = 'hm-lang-zh';
    zh.textContent = zhText;
    frag.appendChild(zh);
    parent.replaceChild(frag, textNode);
  }

  function injectStyles() {
    if (document.getElementById('hm-lang-switcher-style')) return;
    var s = document.createElement('style');
    s.id = 'hm-lang-switcher-style';
    s.textContent =
      // Default: show everything (SSR-safe, in case JS fails).
      'body.lang-en .hm-lang-zh, body.lang-en [lang="zh"], body.lang-en [lang="zh-CN"], body.lang-en [lang="zh-TW"] { display: none !important; }' +
      'body.lang-en .hm-lang-sep { display: none; }' +
      'body.lang-zh .hm-lang-en, body.lang-zh [lang="en"] { display: none !important; }' +
      'body.lang-zh .hm-lang-sep { display: none; }' +

      // Switcher pill — floats into the nav via injectSwitcherInNav.
      '.hm-lang-pill{display:inline-flex;border:1px solid var(--border);border-radius:999px;overflow:hidden;font-size:var(--text-xs);font-family:inherit;}' +
      '.hm-lang-pill-btn{padding:4px 10px;cursor:pointer;background:transparent;border:none;color:var(--stone);font-family:inherit;font-size:inherit;transition:all .15s;}' +
      '.hm-lang-pill-btn:hover{background:var(--washi);color:var(--ink);}' +
      '.hm-lang-pill-btn.is-active{background:var(--ink);color:var(--washi);cursor:default;}' +
      '';
    document.head.appendChild(s);
  }

  /**
   * Insert a switcher pill into the page navigation.
   * Skipped on pages that already have a .lang-switcher / .lang-btn
   * of their own (the landing page has its own — we just wire it
   * up below instead of adding a second one).
   */
  function injectSwitcherInNav() {
    if (document.querySelector('.hm-lang-pill')) return; // already injected
    // Page already has its own switcher — don't duplicate it, just
    // make sure it's wired (wireExistingSwitchers handles this).
    if (document.querySelector('.lang-switcher, .lang-btn, [data-lang][data-lang]:not([data-lang-switch])')) return;

    var pill = document.createElement('span');
    pill.className = 'hm-lang-pill';
    pill.innerHTML =
      '<button type="button" class="hm-lang-pill-btn" data-lang-switch="en">EN</button>' +
      '<button type="button" class="hm-lang-pill-btn" data-lang-switch="zh" style="font-family:var(--font-zh);">中</button>';
    pill.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-lang-switch]');
      if (! btn) return;
      setLang(btn.getAttribute('data-lang-switch'));
    });

    // Prefer placing inside the primary nav menu (before the user
    // greeting / signout); fall back to floating.
    var navMenu = document.querySelector('nav.nav .nav-menu');
    if (navMenu) {
      var li = document.createElement('li');
      li.appendChild(pill);
      // Insert before the user-greeting item if present, else at end.
      var greet = navMenu.querySelector('#user-greeting');
      if (greet) navMenu.insertBefore(li, greet);
      else       navMenu.appendChild(li);
    } else {
      pill.style.cssText = 'position:fixed;top:16px;right:16px;z-index:100;background:var(--bg);';
      document.body.appendChild(pill);
    }

    // Reflect current state on the buttons.
    var cur = getLang();
    pill.querySelectorAll('[data-lang-switch]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-lang-switch') === cur);
    });
  }

  /**
   * Wire the landing page's existing .lang-btn buttons to call our
   * setLang(), and update their is-active state on lang change.
   * Idempotent — safe to call multiple times.
   */
  function wireExistingSwitchers() {
    document.querySelectorAll('.lang-btn[data-lang]').forEach(function (btn) {
      if (btn._hmWired) return;
      btn._hmWired = true;
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-lang'));
      });
    });
    reflectActiveOnExistingSwitchers();
  }

  function reflectActiveOnExistingSwitchers() {
    var cur = getLang();
    document.querySelectorAll('.lang-btn[data-lang]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === cur);
    });
  }

  // Re-run the DOM walker when the panel changes — the router
  // swaps #panel-container innerHTML on every route.
  var obs = null;
  function startObserver() {
    var panel = document.getElementById('panel-container') || document.body;
    if (obs) obs.disconnect();
    obs = new MutationObserver(function (mutations) {
      // Debounce — only walk when DOM settles.
      if (startObserver._t) clearTimeout(startObserver._t);
      startObserver._t = setTimeout(function () {
        walkAndWrap(panel);
      }, 80);
    });
    obs.observe(panel, { childList: true, subtree: true, characterData: false });
  }

  function init() {
    injectStyles();
    var cur = getLang();
    document.documentElement.setAttribute('lang', cur);
    document.body.classList.add('lang-' + cur);
    walkAndWrap(document.body);
    injectSwitcherInNav();
    wireExistingSwitchers();
    startObserver();
    window.addEventListener('hashchange', function () {
      // After route change, let the router finish rendering, then wrap.
      setTimeout(function () {
        walkAndWrap(document.body);
        wireExistingSwitchers();
      }, 120);
    });
  }

  // Kick off once DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  HM.langSwitch = {
    get:     getLang,
    set:     setLang,
    rewalk:  function () { walkAndWrap(document.body); },
  };
})();
