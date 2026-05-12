/**
 * Public blog list loader (v3).
 *
 * Renders the blog index with:
 *   - Category filter pills above the grid
 *   - First post gets a featured 2-col-wide layout on desktop
 *   - Sophisticated SVG fallback covers (botanical accents, washi
 *     texture, color-keyed by category) instead of a single kanji
 *     on a plain gradient
 *   - Per-card category pill, reading-time + date meta
 *
 * Falls back to a friendly "No articles" / "Coming soon" state on
 * empty/error so the page never looks broken.
 */
(function () {
  'use strict';
  var listEl = document.getElementById('blog-list');
  if (!listEl) return;

  var API_BASE = (window.HM && HM.config && HM.config.API_BASE) ||
                 'https://hansmed-system-production.up.railway.app/api';

  // ── State ──
  var state = {
    posts: [],
    categories: [],
    activeCategory: null, // null = all, otherwise category slug
  };

  // ── Helpers ──
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Render text with EN/ZH spans when both halves exist; otherwise
   *  render plain (visible in both modes). Truncate is applied
   *  per-half so the short-end isn't padded.
   *  @param {string} en        – English text
   *  @param {string} zh        – Chinese text (may be null/empty)
   *  @param {number} [trunc]   – optional max char count per half
   */
  function bilingual(en, zh, trunc) {
    function cut(s) {
      if (!s) return '';
      return trunc && s.length > trunc ? s.slice(0, trunc - 1) + '…' : s;
    }
    if (en && zh) {
      return '<span lang="en">' + esc(cut(en)) + '</span>' +
             '<span lang="zh">' + esc(cut(zh)) + '</span>';
    }
    return esc(cut(en || zh || ''));
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getFullYear();
    } catch (_) { return ''; }
  }

  /**
   * Color-key a fallback cover by category slug. Using the existing
   * brand palette so it stays cohesive with the rest of the site.
   */
  function paletteFor(slug) {
    var p = {
      treatments:  { bg: '#FAEFE2', accent: '#9A6035', stroke: '#B8895A', element: 'metal' },
      wellness:    { bg: '#EEF3E8', accent: '#5A7848', stroke: '#6E8C5A', element: 'wood' },
      teleconsult: { bg: '#E5EDF5', accent: '#3F6594', stroke: '#5C82AB', element: 'water' },
      tongue:      { bg: '#F5DCD8', accent: '#A04545', stroke: '#C06A5A', element: 'fire' },
      herbs:       { bg: '#F1E8D2', accent: '#8C6340', stroke: '#A88858', element: 'earth' },
      news:        { bg: '#F3EDE1', accent: '#6E5A3A', stroke: '#8A7558', element: 'neutral' },
    };
    return p[slug] || p.news;
  }

  /**
   * Decorative botanical SVG corner accents — choose one of three
   * variants based on category element so cards aren't visually
   * identical when covers are missing.
   */
  function botanicalSvg(palette) {
    var stroke = palette.stroke;
    var accent = palette.accent;
    return (
      '<svg viewBox="0 0 200 160" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.55;">' +
        '<defs>' +
          '<pattern id="washi" width="6" height="6" patternUnits="userSpaceOnUse">' +
            '<circle cx="2" cy="2" r="0.5" fill="' + stroke + '" opacity="0.18"/>' +
          '</pattern>' +
        '</defs>' +
        '<rect width="200" height="160" fill="url(#washi)"/>' +
        // Top-left botanical sprig
        '<path d="M-4 18 Q22 8 48 22" stroke="' + stroke + '" stroke-width="1.2" fill="none" opacity="0.65"/>' +
        '<path d="M14 16 Q22 4 18 -3 Q12 5 14 16Z" fill="' + accent + '" opacity="0.45"/>' +
        '<path d="M28 18 Q35 6 30 -2 Q24 7 28 18Z" fill="' + accent + '" opacity="0.4"/>' +
        '<circle cx="48" cy="22" r="2" fill="' + accent + '" opacity="0.6"/>' +
        // Bottom-right botanical sprig
        '<path d="M150 142 Q172 132 198 144" stroke="' + stroke + '" stroke-width="1.2" fill="none" opacity="0.5"/>' +
        '<path d="M168 138 Q174 128 170 122 Q164 130 168 138Z" fill="' + accent + '" opacity="0.4"/>' +
        '<path d="M184 142 Q190 132 186 126 Q180 134 184 142Z" fill="' + accent + '" opacity="0.35"/>' +
      '</svg>'
    );
  }

  /**
   * Build the cover area — uses post.cover_image_url if present,
   * otherwise renders a sophisticated SVG fallback color-keyed to
   * the category, with kanji centred and label below.
   */
  function coverHtml(post, featured) {
    var height = featured ? '300px' : '170px';
    if (post.cover_image_url) {
      return '<div style="background:url(\'' + esc(post.cover_image_url) +
        '\') center/cover no-repeat;height:' + height + ';border-bottom:1px solid var(--bdr-l);"></div>';
    }
    var palette = paletteFor((post.category && post.category.slug) || '');
    var initial = post.thumb_initial || '文';
    var label   = post.thumb_label || (post.category && post.category.name) || 'Article';
    var initialSize = featured ? '88px' : '52px';
    var labelSize   = featured ? '11px' : '10px';
    return (
      '<div style="position:relative;height:' + height + ';overflow:hidden;border-bottom:1px solid var(--bdr-l);' +
                  'background:linear-gradient(135deg,' + palette.bg + ' 0%,#FCF6EF 100%);">' +
        botanicalSvg(palette) +
        '<div style="position:relative;height:100%;display:flex;align-items:center;justify-content:center;">' +
          '<div style="text-align:center;">' +
            '<div style="font-family:\'Noto Serif SC\',serif;font-size:' + initialSize + ';font-weight:300;color:' + palette.accent + ';line-height:1;">' +
              esc(initial) +
            '</div>' +
            '<div style="font-size:' + labelSize + ';color:' + palette.accent + ';letter-spacing:0.16em;text-transform:uppercase;margin-top:6px;font-weight:600;">' +
              esc(label) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /** A single non-featured card. */
  function cardHtml(post) {
    var href = 'article.html?slug=' + encodeURIComponent(post.slug);
    var meta = [];
    if (post.reading_time_min) meta.push(post.reading_time_min + ' min · ' + post.reading_time_min + ' 分鐘');
    var when = fmtDate(post.published_at);
    if (when) meta.push(when);
    var metaLine = meta.join(' · ');

    var catPill = '';
    if (post.category) {
      var p = paletteFor(post.category.slug || '');
      catPill = '<span style="position:absolute;top:14px;left:14px;background:' + p.bg + 'EE;' +
        'border:1px solid ' + p.stroke + '40;color:' + p.accent + ';font-size:10px;letter-spacing:0.12em;' +
        'text-transform:uppercase;font-weight:600;padding:5px 11px;border-radius:999px;backdrop-filter:blur(4px);">' +
        esc(post.category.name) + '</span>';
    }

    return '<a href="' + href + '" class="card" style="padding:0;overflow:hidden;border-radius:16px;text-decoration:none;color:inherit;display:block;position:relative;">' +
      '<div class="ctr"></div><div class="cbl"></div>' +
      '<div style="position:relative;">' + coverHtml(post, false) + catPill + '</div>' +
      '<div style="padding:22px 22px 26px;">' +
        '<h3 style="font-family:\'Cormorant Garamond\',serif;font-size:21px;font-weight:500;color:var(--ink);line-height:1.28;margin-bottom:10px;letter-spacing:-0.01em;">' +
          bilingual(post.title, post.title_zh) +
        '</h3>' +
        (post.excerpt || post.excerpt_zh
          ? '<p style="font-size:13px;color:var(--mu);line-height:1.72;font-weight:300;margin-bottom:18px;">' +
            bilingual(post.excerpt, post.excerpt_zh, 130) + '</p>'
          : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:12px;color:var(--ink-m);font-weight:500;">' + esc(post.author_name) + '</div>' +
            (metaLine ? '<div style="font-size:11px;color:var(--mu);font-weight:300;">' + esc(metaLine) + '</div>' : '') +
          '</div>' +
          '<span class="btn btn-outline btn-sm" style="border-radius:8px;flex-shrink:0;">Read →</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /** Featured (first) post — larger cover, two-column body. */
  function featuredHtml(post) {
    var href = 'article.html?slug=' + encodeURIComponent(post.slug);
    var meta = [];
    if (post.reading_time_min) meta.push(post.reading_time_min + ' min · ' + post.reading_time_min + ' 分鐘');
    var when = fmtDate(post.published_at);
    if (when) meta.push(when);

    var catPill = '';
    if (post.category) {
      var p = paletteFor(post.category.slug || '');
      catPill = '<span style="position:absolute;top:18px;left:18px;background:' + p.bg + 'EE;' +
        'border:1px solid ' + p.stroke + '40;color:' + p.accent + ';font-size:11px;letter-spacing:0.14em;' +
        'text-transform:uppercase;font-weight:600;padding:6px 14px;border-radius:999px;backdrop-filter:blur(4px);">' +
        esc(post.category.name) + '</span>';
    }

    return '<a href="' + href + '" class="card" style="grid-column:1/-1;padding:0;overflow:hidden;border-radius:18px;text-decoration:none;color:inherit;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:300px;position:relative;">' +
      '<div class="ctr"></div><div class="cbl"></div>' +
      '<div style="position:relative;">' + coverHtml(post, true) + catPill + '</div>' +
      '<div style="padding:36px 32px;display:flex;flex-direction:column;justify-content:center;">' +
        '<div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--wd-md,#9A6035);font-weight:600;margin-bottom:14px;">' +
          '<span lang="en">Featured Article</span><span lang="zh">精選文章</span>' +
        '</div>' +
        '<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(24px,3vw,32px);font-weight:500;color:var(--ink);line-height:1.2;margin-bottom:14px;letter-spacing:-0.015em;">' +
          bilingual(post.title, post.title_zh) +
        '</h2>' +
        (post.excerpt || post.excerpt_zh
          ? '<p style="font-size:15px;color:var(--mu);line-height:1.72;font-weight:300;margin-bottom:22px;">' +
            bilingual(post.excerpt, post.excerpt_zh, 200) + '</p>'
          : '') +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-size:13px;color:var(--ink-m);font-weight:500;">' + esc(post.author_name) + '</div>' +
            (meta.length ? '<div style="font-size:11.5px;color:var(--mu);font-weight:300;">' + esc(meta.join(' · ')) + '</div>' : '') +
          '</div>' +
          '<span class="btn btn-dark btn-sm" style="border-radius:8px;">' +
            '<span lang="en">Read article →</span><span lang="zh">閱讀文章 →</span>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /** Filter pills above the grid. */
  function filtersHtml() {
    var pills = ['<button data-cat="" class="bl-fp' + (state.activeCategory === null ? ' is-active' : '') +
      '" style="' + filterPillStyle(state.activeCategory === null) + '">' +
      '<span lang="en">All</span><span lang="zh">全部</span></button>'];
    state.categories.forEach(function (c) {
      var active = state.activeCategory === c.slug;
      pills.push('<button data-cat="' + esc(c.slug) + '" class="bl-fp' + (active ? ' is-active' : '') +
        '" style="' + filterPillStyle(active) + '">' + esc(c.name) +
        (c.name_zh ? ' · ' + esc(c.name_zh) : '') + '</button>');
    });
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:32px;">' +
      pills.join('') + '</div>';
  }
  function filterPillStyle(active) {
    var base = 'padding:7px 16px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.04em;cursor:pointer;font-family:inherit;transition:all 0.15s;';
    if (active) return base + 'background:var(--ink,#1a1612);color:#fff;border:1px solid var(--ink,#1a1612);';
    return base + 'background:transparent;color:var(--mu);border:1px solid var(--bdr,#D8C9AE);';
  }

  // ── Render ──
  function render() {
    var visible = state.activeCategory
      ? state.posts.filter(function (p) { return p.category && p.category.slug === state.activeCategory; })
      : state.posts;

    if (!state.posts.length) {
      listEl.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--mu);">' +
          '<div style="font-family:\'Noto Serif SC\',serif;font-size:64px;color:var(--bdr);margin-bottom:18px;">文</div>' +
          '<p style="font-size:15px;font-weight:500;color:var(--ink);margin-bottom:6px;">' +
            '<span lang="en">No articles published yet</span><span lang="zh">暫無已發布文章</span>' +
          '</p>' +
          '<p style="font-size:13px;color:var(--mu);font-weight:300;">' +
            '<span lang="en">Our practitioners are working on the first articles. Check back soon.</span>' +
            '<span lang="zh">中醫師正在撰寫首批文章，敬請期待。</span>' +
          '</p>' +
        '</div>';
      return;
    }

    var html = '';
    if (state.categories.length) html += filtersHtml();
    html += '<div class="g3" style="gap:22px;">';
    if (visible.length) {
      visible.forEach(function (p, i) {
        // Featured layout only for first card AND only when no category
        // filter is active (so a category view stays uniform).
        if (i === 0 && state.activeCategory === null && visible.length > 1) {
          html += featuredHtml(p);
        } else {
          html += cardHtml(p);
        }
      });
    } else {
      html += '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--mu);font-size:14px;">' +
        '<span lang="en">No articles in this category yet.</span>' +
        '<span lang="zh">此分類暫無文章。</span></div>';
    }
    html += '</div>';
    listEl.innerHTML = html;

    // Wire filter clicks
    listEl.querySelectorAll('.bl-fp').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.getAttribute('data-cat');
        state.activeCategory = slug || null;
        render();
        // Scroll to grid top so user sees filtered results
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderError() {
    listEl.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--mu);font-size:14px;">' +
        '<span lang="en">Could not load articles. Please try again later.</span>' +
        '<span lang="zh">暫無法載入文章，請稍後再試。</span>' +
      '</div>';
  }

  // ── Fetch posts + categories in parallel ──
  Promise.all([
    fetch(API_BASE + '/blog/posts?per_page=30',  { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }),
    fetch(API_BASE + '/blog/categories',         { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function(){ return null; }),
  ]).then(function (out) {
    var postsRes = out[0], catRes = out[1];
    if (!postsRes) return renderError();
    state.posts = postsRes.data || [];
    state.categories = (catRes && catRes.categories) || [];
    render();
  }).catch(function (e) {
    console.warn('blog list fetch failed:', e && e.message);
    renderError();
  });
})();
