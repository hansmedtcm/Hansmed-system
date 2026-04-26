/**
 * Admin Blog Panel — list / create / edit / approve / reject /
 * delete blog posts, plus manage categories.
 *
 * Uses HM.blogEditor for the post editor itself; this file is the
 * list view + filters + per-row actions.
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  var state = { status: '', categories: [] };

  function statusPill(s) {
    var map = {
      draft:          ['Draft',          '#7a7468'],
      pending_review: ['Pending Review', '#a16207'],
      published:      ['Published',      '#15803d'],
      archived:       ['Archived',       '#525252'],
    };
    var pair = map[s] || [s, '#525252'];
    return '<span class="badge" style="background:' + pair[1] + '20;color:' + pair[1] + ';padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;">' + pair[0] + '</span>';
  }

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Blog · 部落格</div>' +
      '<h1 class="page-title">Articles</h1></div>' +
      '<div class="flex gap-2">' +
        '<button class="btn btn--outline" id="bl-cats">Categories · 分類</button>' +
        '<button class="btn btn--primary" id="bl-new">+ New Post</button>' +
      '</div>' +
    '</div>' +

    '<div class="flex gap-2 mb-4" id="bl-filters" style="flex-wrap:wrap;">' +
      '<button class="btn btn--ghost btn--sm bl-filter is-active" data-status="">All</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="draft">Drafts</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="pending_review">Pending Review</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="published">Published</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="archived">Archived</button>' +
    '</div>' +

    '<div id="bl-list"></div>';

    document.getElementById('bl-new').addEventListener('click', function () { openEditor(null); });
    document.getElementById('bl-cats').addEventListener('click', openCategoryManager);
    document.querySelectorAll('.bl-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bl-filter').forEach(function (x) { x.classList.remove('is-active'); x.classList.remove('btn--primary'); });
        b.classList.add('is-active'); b.classList.add('btn--primary');
        state.status = b.getAttribute('data-status') || '';
        load();
      });
    });
    // Visually mark the default active button
    document.querySelector('.bl-filter[data-status=""]').classList.add('btn--primary');

    // Categories load once, cached on state — used by the editor too.
    try {
      var cres = await HM.api.blog.listCategories();
      state.categories = cres.categories || [];
    } catch (_) { state.categories = []; }

    await load();
  }

  async function load() {
    var container = document.getElementById('bl-list');
    HM.state.loading(container);
    try {
      var qs = state.status ? 'status=' + encodeURIComponent(state.status) : '';
      var res = await HM.api.blog.listPosts(qs);
      var posts = (res && res.data) || [];
      if (!posts.length) {
        HM.state.empty(container, { icon: '📝', title: 'No posts yet', text: 'Click "New Post" to write your first article.' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr>' +
        '<th>Title</th><th>Author</th><th>Category</th><th>Status</th><th>Updated</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      posts.forEach(function (p) {
        var tr = document.createElement('tr');
        var actions = '<button class="btn btn--outline btn--sm" data-edit>Edit</button>';
        if (p.status === 'pending_review') {
          actions += ' <button class="btn btn--primary btn--sm" data-approve>Approve</button>' +
                     ' <button class="btn btn--ghost btn--sm" data-reject>Reject</button>';
        }
        actions += ' <button class="btn btn--ghost btn--sm" data-del style="color:#9a3a2a;">Delete</button>';

        tr.innerHTML =
          '<td data-label="Title"><div style="font-weight:600;">' + HM.format.esc(p.title) + '</div>' +
            (p.title_zh ? '<div style="font-size:12px;color:var(--mu);">' + HM.format.esc(p.title_zh) + '</div>' : '') +
            '<div style="font-size:11px;color:var(--mu);font-family:monospace;">/' + HM.format.esc(p.slug) + '</div></td>' +
          '<td data-label="Author">' + HM.format.esc(p.author_name || '—') + '</td>' +
          '<td data-label="Category">' + HM.format.esc((p.category && p.category.name) || '—') + '</td>' +
          '<td data-label="Status">' + statusPill(p.status) + '</td>' +
          '<td data-label="Updated">' + HM.format.date(p.updated_at) + '</td>' +
          '<td data-label="Actions"><div class="flex gap-2" style="flex-wrap:wrap;">' + actions + '</div></td>';

        tr.querySelector('[data-edit]').addEventListener('click', function () { openEditor(p); });
        var ap = tr.querySelector('[data-approve]');
        if (ap) ap.addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Approve and publish this post?', { title: 'Approve · 核准發佈' });
          if (!ok) return;
          try { await HM.api.blog.approvePost(p.id); HM.ui.toast('Published', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        var rj = tr.querySelector('[data-reject]');
        if (rj) rj.addEventListener('click', async function () {
          var reason = await HM.ui.prompt('Reason for sending back to draft?', { title: 'Reject · 退回草稿', placeholder: 'Optional reason for the author' });
          if (reason === null) return;
          try { await HM.api.blog.rejectPost(p.id, reason); HM.ui.toast('Sent back to draft', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        tr.querySelector('[data-del]').addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Delete this post? This cannot be undone.', { title: 'Delete post?', danger: true });
          if (!ok) return;
          try { await HM.api.blog.deletePost(p.id); HM.ui.toast('Deleted', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function openEditor(post) {
    // For an existing post we re-fetch to get the full body_html which the
    // list payload trims out.
    var full = post;
    if (post && post.id) {
      try {
        var res = await HM.api.blog.getPost(post.id);
        full = (res && res.post) || post;
      } catch (_) { /* fall back to whatever we already had */ }
    }
    HM.blogEditor.open(full, {
      mode: 'admin',
      categories: state.categories,
      onSaved: function () { load(); },
    });
  }

  // ── Category manager (admin only) ──
  function openCategoryManager() {
    var m = HM.ui.modal({
      size: 'lg',
      title: 'Blog Categories · 文章分類',
      content:
        '<div id="cm-list" style="margin-bottom:16px;"></div>' +
        '<form id="cm-form" class="field-grid field-grid--2" style="align-items:end;border-top:1px solid var(--bdr-l);padding-top:16px;">' +
          '<div class="field"><label class="field-label">Slug</label>' +
            '<input name="slug" pattern="[a-z0-9-]+" required class="field-input field-input--boxed" placeholder="e.g. wellness"></div>' +
          '<div class="field"><label class="field-label">Name (English)</label>' +
            '<input name="name" required class="field-input field-input--boxed"></div>' +
          '<div class="field"><label class="field-label">Name · 中文</label>' +
            '<input name="name_zh" class="field-input field-input--boxed"></div>' +
          '<div class="field"><label class="field-label">Display order</label>' +
            '<input name="display_order" type="number" value="100" class="field-input field-input--boxed"></div>' +
          '<button type="submit" class="btn btn--primary" style="grid-column:1/-1;">+ Add Category</button>' +
        '</form>',
    });
    var listEl = m.element.querySelector('#cm-list');
    var form = m.element.querySelector('#cm-form');

    async function refresh() {
      listEl.innerHTML = '<div class="state state--loading"><div class="state-text">Loading…</div></div>';
      try {
        var res = await HM.api.blog.listCategories();
        var cats = res.categories || [];
        state.categories = cats;
        if (!cats.length) {
          listEl.innerHTML = '<div class="state state--empty"><div class="state-text">No categories yet — add one below.</div></div>';
          return;
        }
        listEl.innerHTML = '<table class="table"><thead><tr><th>Slug</th><th>Name</th><th>中文</th><th>Order</th><th></th></tr></thead><tbody></tbody></table>';
        var tbody = listEl.querySelector('tbody');
        cats.forEach(function (c) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td><code>' + HM.format.esc(c.slug) + '</code></td>' +
            '<td>' + HM.format.esc(c.name) + '</td>' +
            '<td>' + HM.format.esc(c.name_zh || '') + '</td>' +
            '<td>' + (c.display_order != null ? c.display_order : '') + '</td>' +
            '<td><button class="btn btn--ghost btn--sm" data-del style="color:#9a3a2a;">Delete</button></td>';
          tr.querySelector('[data-del]').addEventListener('click', async function () {
            var ok = await HM.ui.confirm('Delete category "' + c.name + '"? Posts in this category keep their text but lose the link.', { danger: true });
            if (!ok) return;
            try { await HM.api.blog.deleteCategory(c.id); HM.ui.toast('Deleted', 'success'); refresh(); }
            catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
          });
          tbody.appendChild(tr);
        });
      } catch (e) {
        listEl.innerHTML = '<div class="alert alert--danger">' + HM.format.esc(e.message || 'Failed') + '</div>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      if (d.display_order) d.display_order = parseInt(d.display_order, 10);
      HM.form.setLoading(form, true);
      try {
        await HM.api.blog.createCategory(d);
        form.reset();
        HM.ui.toast('Category added', 'success');
        refresh();
      } catch (err) {
        HM.form.showGeneralError(form, err.message || 'Failed');
      } finally {
        HM.form.setLoading(form, false);
      }
    });

    refresh();
  }

  HM.adminPanels.blog = { render: render };
})();
