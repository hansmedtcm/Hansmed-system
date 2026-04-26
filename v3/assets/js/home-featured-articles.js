/**
 * Homepage featured-articles loader.
 *
 * Fetches the 3 most recent published posts from /api/blog/posts and
 * renders compact cards into #home-blog-list. Falls back gracefully
 * to a friendly "More articles coming soon" state on empty/error so
 * the section never looks broken on first deploy.
 */
(function () {
  'use strict';
  var listEl = document.getElementById('home-blog-list');
  if (!listEl) return;

  var API_BASE = (window.HM && HM.config && HM.config.API_BASE) ||
                 'https://hansmed-system-production.up.railway.app/api';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getFullYear();
    } catch (_) { return ''; }
  }

  function cardHtml(post) {
    var href = 'article.html?slug=' + encodeURIComponent(post.slug);
    var coverInner;
    if (post.cover_image_url) {
      coverInner = '<div style="background:url(\'' + esc(post.cover_image_url) +
        '\') center/cover no-repeat;height:140px;border-bottom:1px solid var(--v4-bdr-l);"></div>';
    } else {
      var initial = post.thumb_initial || '文';
      var label   = post.thumb_label   || 'ARTICLE';
      coverInner =
        '<div style="background:linear-gradient(135deg,var(--v4-bg-2) 0%,#FCF6EF 100%);' +
                    'height:140px;display:flex;align-items:center;justify-content:center;' +
                    'border-bottom:1px solid var(--v4-bdr-l);">' +
          '<div style="text-align:center;">' +
            '<div style="font-family:\'Noto Serif SC\',serif;font-size:38px;font-weight:300;color:var(--v4-wd-md);line-height:1;">' +
              esc(initial) +
            '</div>' +
            '<div style="font-size:9.5px;color:var(--v4-mu);letter-spacing:0.12em;text-transform:uppercase;margin-top:4px;">' +
              esc(label) +
            '</div>' +
          '</div>' +
        '</div>';
    }

    var meta = [];
    if (post.reading_time_min) meta.push(post.reading_time_min + ' min');
    var when = fmtDate(post.published_at);
    if (when) meta.push(when);
    var metaLine = meta.join(' · ');

    return '<a href="' + href + '" class="card-v4" style="padding:0;overflow:hidden;border-radius:14px;text-decoration:none;color:inherit;display:block;">' +
      '<div class="ctr"></div><div class="cbl"></div>' +
      coverInner +
      '<div style="padding:18px 20px 22px;">' +
        '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:19px;font-weight:500;color:var(--v4-ink);line-height:1.3;margin-bottom:8px;letter-spacing:-0.01em;">' +
          esc(post.title) +
        '</h3>' +
        (post.excerpt
          ? '<p style="font-size:12.5px;color:var(--v4-mu);line-height:1.7;font-weight:300;margin-bottom:14px;">' +
            esc(post.excerpt.length > 120 ? post.excerpt.slice(0, 117) + '…' : post.excerpt) + '</p>'
          : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--v4-mu);">' +
          '<span>' + esc(post.author_name || '') + '</span>' +
          (metaLine ? '<span>' + esc(metaLine) + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</a>';
  }

  function renderEmpty() {
    listEl.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--v4-mu);font-size:14px;">' +
        '<span lang="en">Articles coming soon.</span>' +
        '<span lang="zh">文章即將推出。</span>' +
      '</div>';
  }

  fetch(API_BASE + '/blog/posts?per_page=3', { credentials: 'omit' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (res) {
      var posts = (res && res.data) || [];
      if (posts.length === 0) return renderEmpty();
      listEl.innerHTML = posts.slice(0, 3).map(cardHtml).join('');
    })
    .catch(function (e) {
      // Silently fall back — homepage shouldn't show error UX over a
      // failed blog fetch when the rest of the page works fine.
      renderEmpty();
    });
})();
