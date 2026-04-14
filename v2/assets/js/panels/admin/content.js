/**
 * Admin Content CMS — privacy, terms, FAQ, about pages
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header flex-between">' +
      '<div><div class="page-header-label">Content · 內容管理</div>' +
      '<h1 class="page-title">Static Pages CMS</h1></div>' +
      '<button class="btn btn--primary" id="new-content">+ New Page</button></div>' +
      '<div id="cnt-list"></div>';

    document.getElementById('new-content').addEventListener('click', function () { showEditor(null); });
    await load();
  }

  async function load() {
    var container = document.getElementById('cnt-list');
    HM.state.loading(container);
    try {
      var res = await HM.api.admin.listContent();
      var items = res.data || [];
      if (!items.length) {
        HM.state.empty(container, { icon: '📄', title: 'No pages yet', text: 'Create pages like privacy, terms, about, FAQ' });
        return;
      }
      container.innerHTML = '<div class="table-wrap"><table class="table table--responsive"><thead><tr><th>Slug</th><th>Title</th><th>Updated</th><th></th></tr></thead><tbody></tbody></table></div>';
      var tbody = container.querySelector('tbody');
      items.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td data-label="Slug"><code>' + HM.format.esc(p.slug) + '</code></td>' +
          '<td data-label="Title">' + HM.format.esc(p.title) + '</td>' +
          '<td data-label="Updated">' + HM.format.date(p.updated_at) + '</td>' +
          '<td data-label="Actions"><div class="flex gap-2">' +
          '<button class="btn btn--outline btn--sm" data-edit>Edit</button>' +
          '<button class="btn btn--ghost btn--sm" data-del>Delete</button>' +
          '</div></td>';
        tr.querySelector('[data-edit]').addEventListener('click', function () { showEditor(p); });
        tr.querySelector('[data-del]').addEventListener('click', async function () {
          var ok = await HM.ui.confirm('Delete this page? This cannot be undone.', { title: 'Delete page?', danger: true });
          if (!ok) return;
          try { await HM.api.admin.deleteContent(p.slug); HM.ui.toast('Deleted', 'success'); load(); }
          catch (e) { HM.ui.toast(e.message, 'danger'); }
        });
        tbody.appendChild(tr);
      });
    } catch (e) { HM.state.error(container, e); }
  }

  function showEditor(page) {
    var isNew = !page;
    var m = HM.ui.modal({
      size: 'xl',
      title: isNew ? 'New Page · 新增頁面' : 'Edit Page · 編輯頁面',
      content: '<form id="ed-form">' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label" data-required>Slug · 路徑</label>' +
        '<input name="slug" class="field-input field-input--boxed" required value="' + HM.format.esc(page ? page.slug : '') + '"' + (isNew ? '' : ' readonly') + ' placeholder="e.g. privacy, terms, faq"></div>' +
        '<div class="field"><label class="field-label" data-required>Title · 標題</label>' +
        '<input name="title" class="field-input field-input--boxed" required value="' + HM.format.esc(page ? page.title : '') + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">Language · 語言</label>' +
        '<select name="lang" class="field-input field-input--boxed">' +
        '<option value="en"' + (page && page.lang === 'en' ? ' selected' : '') + '>English</option>' +
        '<option value="zh"' + (page && page.lang === 'zh' ? ' selected' : '') + '>中文</option>' +
        '</select></div>' +
        '<div class="field"><label class="field-label" data-required>Body · 內容 (HTML supported)</label>' +
        '<textarea name="body" class="field-input field-input--boxed" required rows="16" style="font-family: monospace; font-size: var(--text-sm);">' + HM.format.esc(page ? page.body : '') + '</textarea></div>' +
        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary btn--block mt-4">Save Page</button>' +
        '</form>',
    });

    var form = m.element.querySelector('#ed-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = HM.form.serialize(form);
      HM.form.setLoading(form, true);
      try {
        await HM.api.admin.saveContent(d);
        m.close();
        HM.ui.toast('Saved', 'success');
        load();
      } catch (err) {
        HM.form.setLoading(form, false);
        HM.form.showGeneralError(form, err.message || 'Failed');
      }
    });
  }

  HM.adminPanels.content = { render: render };
})();
