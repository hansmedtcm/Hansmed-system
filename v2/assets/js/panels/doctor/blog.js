/**
 * Doctor Blog Panel — doctors can author articles, save as draft,
 * and submit for admin review. They cannot publish directly and
 * cannot see other doctors' posts (backend enforces both).
 */
(function () {
  'use strict';
  HM.doctorPanels = HM.doctorPanels || {};

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
      '<h1 class="page-title">My Articles</h1>' +
      '<p style="color:var(--mu);margin-top:4px;">Write articles to share TCM knowledge with patients. Save as a draft, then submit for admin review when ready.</p></div>' +
      '<button class="btn btn--primary" id="bl-new">+ Write New Article</button>' +
    '</div>' +

    '<div class="flex gap-2 mb-4" style="flex-wrap:wrap;">' +
      '<button class="btn btn--ghost btn--sm bl-filter is-active btn--primary" data-status="">All</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="draft">Drafts</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="pending_review">Pending Review</button>' +
      '<button class="btn btn--ghost btn--sm bl-filter" data-status="published">Published</button>' +
    '</div>' +

    '<div id="bl-list"></div>';

    document.getElementById('bl-new').addEventListener('click', function () { openEditor(null); });
    document.querySelectorAll('.bl-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.bl-filter').forEach(function (x) { x.classList.remove('is-active'); x.classList.remove('btn--primary'); });
        b.classList.add('is-active'); b.classList.add('btn--primary');
        state.status = b.getAttribute('data-status') || '';
        load();
      });
    });

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
        HM.state.empty(container, {
          icon: '✍️',
          title: 'No articles yet',
          text: 'Click "Write New Article" to share your TCM knowledge with patients.',
        });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr>' +
        '<th>Title</th><th>Category</th><th>Status</th><th>Updated</th><th></th>' +
        '</tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      posts.forEach(function (p) {
        var tr = document.createElement('tr');
        var actions = '<button class="btn btn--outline btn--sm" data-edit>Edit</button>';
        // Doctors can delete their own draft/pending_review posts only — published ones must go through admin.
        if (p.status === 'draft' || p.status === 'pending_review') {
          actions += ' <button class="btn btn--ghost btn--sm" data-del style="color:#9a3a2a;">Delete</button>';
        }

        tr.innerHTML =
          '<td data-label="Title"><div style="font-weight:600;">' + HM.format.esc(p.title) + '</div>' +
            (p.title_zh ? '<div style="font-size:12px;color:var(--mu);">' + HM.format.esc(p.title_zh) + '</div>' : '') + '</td>' +
          '<td data-label="Category">' + HM.format.esc((p.category && p.category.name) || '—') + '</td>' +
          '<td data-label="Status">' + statusPill(p.status) + '</td>' +
          '<td data-label="Updated">' + HM.format.date(p.updated_at) + '</td>' +
          '<td data-label="Actions"><div class="flex gap-2" style="flex-wrap:wrap;">' + actions + '</div></td>';

        tr.querySelector('[data-edit]').addEventListener('click', function () { openEditor(p); });
        var dl = tr.querySelector('[data-del]');
        if (dl) dl.addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Delete this article? This cannot be undone.', { title: 'Delete article?', danger: true });
          if (!ok) return;
          try { await HM.api.blog.deletePost(p.id); HM.ui.toast('Deleted', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message || 'Failed', 'danger'); }
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  async function openEditor(post) {
    var full = post;
    if (post && post.id) {
      try {
        var res = await HM.api.blog.getPost(post.id);
        full = (res && res.post) || post;
      } catch (_) {}
    }
    HM.blogEditor.open(full, {
      mode: 'doctor',
      categories: state.categories,
      onSaved: function () { load(); },
    });
  }

  HM.doctorPanels.blog = { render: render };
})();
