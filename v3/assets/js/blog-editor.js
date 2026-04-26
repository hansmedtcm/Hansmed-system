/**
 * HM.blogEditor — shared Quill-based blog post editor used by both
 * the admin and doctor blog panels.
 *
 *   HM.blogEditor.open(post|null, {
 *     mode: 'admin' | 'doctor',
 *     categories: [{id, name, name_zh, slug}, …],
 *     onSaved: function (savedPost) { … },   // called on successful save
 *   });
 *
 * Permission differences are handled here:
 *   - 'admin' mode: status dropdown shows draft / pending_review / published / archived
 *   - 'doctor' mode: status dropdown shows draft / submit-for-review only
 *
 * Quill is loaded lazily from a CDN the first time the editor opens —
 * keeps the rest of the portal lean. Image uploads go through
 * HM.api.blog.uploadImage which talks to the R2-backed endpoint.
 */
(function () {
  'use strict';

  var QUILL_CSS = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
  var QUILL_JS  = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js';
  var quillReady = null;

  function loadQuill() {
    if (window.Quill) return Promise.resolve(window.Quill);
    if (quillReady) return quillReady;
    quillReady = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = QUILL_CSS;
      document.head.appendChild(link);

      var s = document.createElement('script');
      s.src = QUILL_JS;
      s.onload = function () { resolve(window.Quill); };
      s.onerror = function () { reject(new Error('Failed to load Quill editor')); };
      document.head.appendChild(s);
    });
    return quillReady;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isoLocal(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      var pad = function (n) { return n < 10 ? '0' + n : n; };
      return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
             'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
    } catch (_) { return ''; }
  }

  /** Build the modal HTML shell. */
  function buildShell(post, opts) {
    var isNew = !post;
    var p = post || {};
    var mode = opts.mode || 'admin';
    var cats = opts.categories || [];

    var statusOptions;
    if (mode === 'admin') {
      statusOptions =
        '<option value="draft">Draft · 草稿</option>' +
        '<option value="pending_review">Pending Review · 待審核</option>' +
        '<option value="published">Published · 已發佈</option>' +
        '<option value="archived">Archived · 已封存</option>';
    } else {
      statusOptions =
        '<option value="draft">Save as Draft · 儲存為草稿</option>' +
        '<option value="pending_review">Submit for Review · 提交審核</option>';
    }

    var catOptions = '<option value="">— None —</option>' + cats.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) +
             (c.name_zh ? ' · ' + esc(c.name_zh) : '') + '</option>';
    }).join('');

    return '' +
      '<form id="be-form" class="blog-editor-form">' +

      // ── Tabs (EN / ZH) ──
      '<div class="be-tabs" role="tablist" style="display:flex;gap:4px;border-bottom:1px solid var(--bdr-l,#e5dfd5);margin-bottom:18px;">' +
        '<button type="button" class="be-tab is-active" data-tab="en" style="padding:10px 18px;background:none;border:none;border-bottom:2px solid var(--ink,#1a1612);font-weight:600;cursor:pointer;color:var(--ink,#1a1612);">English</button>' +
        '<button type="button" class="be-tab" data-tab="zh" style="padding:10px 18px;background:none;border:none;border-bottom:2px solid transparent;font-weight:500;cursor:pointer;color:var(--mu,#7a7468);">中文 (Chinese)</button>' +
        '<button type="button" class="be-tab" data-tab="meta" style="padding:10px 18px;background:none;border:none;border-bottom:2px solid transparent;font-weight:500;cursor:pointer;color:var(--mu,#7a7468);">Settings · 設定</button>' +
      '</div>' +

      // ── EN tab ──
      '<div class="be-pane" data-pane="en">' +
        '<div class="field"><label class="field-label" data-required>Title (English)</label>' +
          '<input name="title" class="field-input field-input--boxed" required value="' + esc(p.title) + '" placeholder="e.g. Understanding TCM Treatments"></div>' +
        '<div class="field"><label class="field-label">Subtitle</label>' +
          '<input name="subtitle" class="field-input field-input--boxed" value="' + esc(p.subtitle) + '" placeholder="Optional secondary line"></div>' +
        '<div class="field"><label class="field-label">Excerpt — shown on the blog index card</label>' +
          '<textarea name="excerpt" class="field-input field-input--boxed" rows="2" maxlength="1000">' + esc(p.excerpt) + '</textarea></div>' +
        '<div class="field"><label class="field-label">Body (English)</label>' +
          '<div id="be-quill-en" style="min-height:340px;background:#fff;"></div>' +
          '<input type="hidden" name="body_html" value="' + esc(p.body_html) + '">' +
        '</div>' +
      '</div>' +

      // ── ZH tab ──
      '<div class="be-pane" data-pane="zh" style="display:none;">' +
        '<div class="field"><label class="field-label">Title · 標題 (中文)</label>' +
          '<input name="title_zh" class="field-input field-input--boxed" value="' + esc(p.title_zh) + '" placeholder="e.g. 中醫治療簡介"></div>' +
        '<div class="field"><label class="field-label">Subtitle · 副標題</label>' +
          '<input name="subtitle_zh" class="field-input field-input--boxed" value="' + esc(p.subtitle_zh) + '"></div>' +
        '<div class="field"><label class="field-label">Excerpt · 摘要</label>' +
          '<textarea name="excerpt_zh" class="field-input field-input--boxed" rows="2" maxlength="1000">' + esc(p.excerpt_zh) + '</textarea></div>' +
        '<div class="field"><label class="field-label">Body · 正文 (中文)</label>' +
          '<div id="be-quill-zh" style="min-height:340px;background:#fff;"></div>' +
          '<input type="hidden" name="body_zh_html" value="' + esc(p.body_zh_html) + '">' +
        '</div>' +
      '</div>' +

      // ── Settings tab ──
      '<div class="be-pane" data-pane="meta" style="display:none;">' +
        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label">Category · 分類</label>' +
            '<select name="category_id" class="field-input field-input--boxed">' + catOptions + '</select></div>' +
          '<div class="field"><label class="field-label">Reading time (minutes)</label>' +
            '<input name="reading_time_min" type="number" min="1" max="60" class="field-input field-input--boxed" value="' + esc(p.reading_time_min || 5) + '"></div>' +
        '</div>' +

        '<div class="field"><label class="field-label">Cover image URL — leave empty to use the fallback thumbnail</label>' +
          '<input name="cover_image_url" type="url" class="field-input field-input--boxed" value="' + esc(p.cover_image_url) + '" placeholder="https://…">' +
          '<div style="margin-top:6px;display:flex;align-items:center;gap:10px;">' +
            '<label class="btn btn--outline btn--sm" style="cursor:pointer;margin:0;">' +
              '<input type="file" id="be-cover-upload" accept="image/*" style="display:none;">' +
              '📤 Upload cover…' +
            '</label>' +
            '<span id="be-cover-status" style="font-size:12px;color:var(--mu,#7a7468);"></span>' +
          '</div>' +
        '</div>' +

        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label">Fallback thumbnail — initial</label>' +
            '<input name="thumb_initial" maxlength="8" class="field-input field-input--boxed" value="' + esc(p.thumb_initial || '文') + '" placeholder="文 / 醫 / 藥"></div>' +
          '<div class="field"><label class="field-label">Fallback thumbnail — label</label>' +
            '<input name="thumb_label" maxlength="60" class="field-input field-input--boxed" value="' + esc(p.thumb_label || 'ARTICLE') + '"></div>' +
        '</div>' +

        '<div class="field-grid field-grid--2">' +
          '<div class="field"><label class="field-label" data-required>Status · 狀態</label>' +
            '<select name="status" class="field-input field-input--boxed">' + statusOptions + '</select>' +
            (mode === 'doctor'
              ? '<div style="font-size:12px;color:var(--mu,#7a7468);margin-top:4px;">Doctors cannot publish directly. Submit for review and an admin will publish it.</div>'
              : '') +
          '</div>' +
          '<div class="field"><label class="field-label">Schedule publish (optional)</label>' +
            '<input name="published_at" type="datetime-local" class="field-input field-input--boxed" value="' + isoLocal(p.published_at) + '">' +
            '<div style="font-size:12px;color:var(--mu,#7a7468);margin-top:4px;">Future date = scheduled. Leave blank to publish immediately when status flips.</div>' +
          '</div>' +
        '</div>' +

        (mode === 'admin' ? '<div class="field"><label class="field-label">Slug — URL path (auto-generated from title if blank)</label>' +
          '<input name="slug" pattern="[a-z0-9-]+" class="field-input field-input--boxed" value="' + esc(p.slug) + '" placeholder="e.g. tcm-treatments">' +
          '<div style="font-size:12px;color:var(--mu,#7a7468);margin-top:4px;">Final URL: /article.html?slug=…</div></div>' : '') +
      '</div>' +

      // ── Action bar ──
      '<div data-general-error class="alert alert--danger" style="display:none;margin-top:14px;"></div>' +
      '<div class="be-actions" style="display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--bdr-l,#e5dfd5);">' +
        (post && post.slug ? '<a href="article.html?slug=' + encodeURIComponent(post.slug) + '" target="_blank" class="btn btn--ghost btn--sm" style="margin-right:auto;">👁 Preview</a>' : '<span style="margin-right:auto;"></span>') +
        '<button type="button" class="btn btn--ghost" data-action="cancel">Cancel · 取消</button>' +
        '<button type="submit" class="btn btn--primary">' + (isNew ? 'Create Post · 建立文章' : 'Save Changes · 儲存變更') + '</button>' +
      '</div>' +

      '</form>';
  }

  /** Initialise Quill on the EN/ZH placeholder divs. */
  function initQuill(Quill, el, initialHtml, hiddenInput, onChange) {
    var quill = new Quill(el, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [2, 3, 4, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image'],
          [{ color: [] }, { background: [] }],
          ['clean'],
        ],
      },
      placeholder: 'Start writing the article…',
    });
    if (initialHtml) {
      // Quill 2.x — paste HTML via clipboard.dangerouslyPasteHTML
      quill.clipboard.dangerouslyPasteHTML(0, initialHtml);
    }
    quill.on('text-change', function () {
      var html = quill.root.innerHTML;
      hiddenInput.value = html;
      if (onChange) onChange(html);
    });

    // Custom image handler — uploads to R2 instead of base64-embedding
    var toolbar = quill.getModule('toolbar');
    toolbar.addHandler('image', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var range = quill.getSelection(true);
        // Insert a placeholder while uploading
        quill.insertText(range.index, '⏳ uploading image…', { italic: true });
        try {
          var res = await HM.api.blog.uploadImage(file);
          // Remove the placeholder
          quill.deleteText(range.index, '⏳ uploading image…'.length);
          quill.insertEmbed(range.index, 'image', res.url);
          quill.setSelection(range.index + 1);
        } catch (err) {
          quill.deleteText(range.index, '⏳ uploading image…'.length);
          var msg = (err && err.message) || 'Upload failed';
          HM.ui.toast('Image upload failed: ' + msg, 'danger', 6000);
        }
      };
      input.click();
    });

    return quill;
  }

  function open(post, opts) {
    opts = opts || {};
    var isNew = !post;

    var m = HM.ui.modal({
      size: 'xl',
      title: isNew ? 'New Blog Post · 新文章' : 'Edit Blog Post · 編輯文章',
      content: buildShell(post, opts),
      dismissible: false,
    });

    var form = m.element.querySelector('#be-form');

    // Status preselect
    if (post && post.status) {
      var sel = form.querySelector('select[name="status"]');
      var match = sel.querySelector('option[value="' + post.status + '"]');
      if (match) sel.value = post.status;
    }
    // Category preselect
    if (post && post.category_id) {
      var cs = form.querySelector('select[name="category_id"]');
      if (cs) cs.value = post.category_id;
    }

    // Tab switching
    var tabs = form.querySelectorAll('.be-tab');
    var panes = form.querySelectorAll('.be-pane');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var which = t.getAttribute('data-tab');
        tabs.forEach(function (x) {
          var active = x.getAttribute('data-tab') === which;
          x.classList.toggle('is-active', active);
          x.style.borderBottomColor = active ? 'var(--ink,#1a1612)' : 'transparent';
          x.style.fontWeight = active ? '600' : '500';
          x.style.color = active ? 'var(--ink,#1a1612)' : 'var(--mu,#7a7468)';
        });
        panes.forEach(function (x) {
          x.style.display = (x.getAttribute('data-pane') === which) ? '' : 'none';
        });
      });
    });

    // Cancel button
    form.querySelector('[data-action="cancel"]').addEventListener('click', function () { m.close(); });

    // Cover image upload
    var coverInput = form.querySelector('#be-cover-upload');
    var coverStatus = form.querySelector('#be-cover-status');
    if (coverInput) {
      coverInput.addEventListener('change', async function () {
        var file = coverInput.files && coverInput.files[0];
        if (!file) return;
        coverStatus.textContent = 'Uploading…';
        try {
          var res = await HM.api.blog.uploadImage(file);
          form.querySelector('input[name="cover_image_url"]').value = res.url;
          coverStatus.textContent = '✓ Uploaded';
        } catch (err) {
          coverStatus.textContent = '✗ ' + ((err && err.message) || 'Upload failed');
        }
      });
    }

    // Initialise Quill (lazy-load CDN)
    loadQuill().then(function (Quill) {
      initQuill(
        Quill,
        form.querySelector('#be-quill-en'),
        (post && post.body_html) || '',
        form.querySelector('input[name="body_html"]')
      );
      initQuill(
        Quill,
        form.querySelector('#be-quill-zh'),
        (post && post.body_zh_html) || '',
        form.querySelector('input[name="body_zh_html"]')
      );
    }).catch(function (err) {
      HM.ui.toast('Editor failed to load: ' + err.message, 'danger', 8000);
    });

    // Submit
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);

      // Empty strings → null for nullable fields the backend doesn't want as ""
      ['title_zh', 'subtitle', 'subtitle_zh', 'excerpt', 'excerpt_zh',
       'body_zh_html', 'cover_image_url', 'thumb_initial', 'thumb_label',
       'slug', 'published_at'].forEach(function (k) {
        if (d[k] === '') delete d[k];
      });
      if (d.category_id === '') delete d.category_id;
      if (d.published_at) {
        // datetime-local → ISO with timezone offset
        d.published_at = new Date(d.published_at).toISOString();
      }

      HM.form.setLoading(form, true);
      try {
        var saved;
        if (isNew) {
          saved = await HM.api.blog.createPost(d);
        } else {
          saved = await HM.api.blog.updatePost(post.id, d);
        }
        m.close();
        HM.ui.toast(isNew ? 'Post created' : 'Saved', 'success');
        if (opts.onSaved) opts.onSaved((saved && saved.post) || saved);
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, (err && err.message) || 'Save failed');
      }
    });

    return m;
  }

  HM.blogEditor = { open: open };
})();
