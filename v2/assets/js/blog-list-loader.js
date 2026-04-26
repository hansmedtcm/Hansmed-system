/**
 * Public blog list loader — fetches /api/blog/posts and renders
 * the card grid into #blog-list on blog.html. Replaces the
 * hardcoded HTML cards we used to ship.
 *
 * Each card renders as a single anchor pointing at
 * article.html?slug=<slug> so the same template-page can render
 * any post.
 */
(function () {
  'use strict';
  var listEl = document.getElementById('blog-list');
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
        '\') center/cover no-repeat;height:160px;border-bottom:1px solid var(--bdr-l);"></div>';
    } else {
      var initial = post.thumb_initial || '文';
      var label   = post.thumb_label   || 'ARTICLE';
      coverInner =
        '<div style="background:linear-gradient(135deg,var(--bg-2) 0%,var(--go-xl,#FCF6EF) 100%);' +
                    'height:160px;display:flex;align-items:center;justify-content:center;' +
                    'border-bottom:1px solid var(--bdr-l);">' +
          '<div style="text-align:center;">' +
            '<div style="font-family:\'Noto Serif SC\',serif;font-size:42px;font-weight:300;color:var(--wd-lt,#B5881A);line-height:1;">' +
              esc(initial) +
            '</div>' +
            '<div style="font-size:10px;color:var(--mu);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">' +
              esc(label) +
            '</div>' +
          '</div>' +
        '</div>';
    }

    var meta = [];
    if (post.reading_time_min) meta.push(post.reading_time_min + ' min read');
    var when = fmtDate(post.published_at);
    if (when) meta.push(when);
    var metaLine = meta.join(' · ');

    return '<a href="' + href + '" class="card" style="padding:0;overflow:hidden;border-radius:16px;text-decoration:none;color:inherit;display:block;">' +
      '<div class="ctr"></div><div class="cbl"></div>' +
      coverInner +
      '<div style="padding:24px 24px 28px;">' +
        '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;font-weight:500;color:var(--ink);line-height:1.25;margin-bottom:10px;letter-spacing:-0.01em;">' +
          esc(post.title) +
        '</h3>' +
        (post.excerpt
          ? '<p style="font-size:13px;color:var(--mu);line-height:1.72;font-weight:300;margin-bottom:18px;">' + esc(post.excerpt) + '</p>'
          : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:12px;color:var(--ink-m);font-weight:500;">' + esc(post.author_name) + '</div>' +
            (metaLine ? '<div style="font-size:11px;color:var(--mu);font-weight:300;">' + esc(metaLine) + '</div>' : '') +
          '</div>' +
          '<span class="btn btn-outline btn-sm" style="border-radius:8px;">Read →</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  function renderEmpty() {
    listEl.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--mu);font-size:14px;">' +
        '<span lang="en">No articles published yet.</span>' +
        '<span lang="zh">暫無已發布文章。</span>' +
      '</div>';
  }

  function renderError() {
    listEl.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--mu);font-size:14px;">' +
        '<span lang="en">Could not load articles. Please try again later.</span>' +
        '<span lang="zh">暫無法載入文章，請稍後再試。</span>' +
      '</div>';
  }

  fetch(API_BASE + '/blog/posts?per_page=30', { credentials: 'omit' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (res) {
      var posts = (res && res.data) || [];
      if (posts.length === 0) return renderEmpty();
      listEl.innerHTML = posts.map(cardHtml).join('');
    })
    .catch(function (e) {
      console.warn('blog list fetch failed:', e.message);
      renderError();
    });
})();
