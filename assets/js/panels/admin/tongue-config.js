/**
 * Admin Tongue Diagnosis Config — API provider, thresholds, report settings
 */
(function () {
  'use strict';
  HM.adminPanels = HM.adminPanels || {};

  async function render(el) {
    el.innerHTML = '<div class="page-header">' +
      '<div class="page-header-label">Tongue Diagnosis Config · 舌診配置</div>' +
      '<h1 class="page-title">AI Tongue Diagnosis Settings</h1>' +
      '</div><div id="tc-body"></div>';

    var body = document.getElementById('tc-body');
    HM.state.loading(body);
    try {
      var res = await HM.api.admin.getTongueConfig();
      var c = res.config || res || {};

      body.innerHTML = '<div class="alert alert--info mb-4">' +
        '<strong>ℹ️ About</strong><br>' +
        'Configure the AI provider used for tongue image analysis and the knowledge base references shown in patient reports. ' +
        'Currently running in <strong>demo mode</strong> using the built-in TCM knowledge base.</div>' +

        '<form id="tc-form">' +

        '<div class="card mb-4">' +
        '<div class="card-title">Provider · AI提供商</div>' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Provider</label>' +
        '<select name="provider" class="field-input field-input--boxed">' +
        '<option value="demo"' + (c.provider === 'demo' ? ' selected' : '') + '>Demo (Built-in KB)</option>' +
        '<option value="claude"' + (c.provider === 'claude' ? ' selected' : '') + '>Claude Vision (Anthropic)</option>' +
        '<option value="openai"' + (c.provider === 'openai' ? ' selected' : '') + '>GPT-4 Vision (OpenAI)</option>' +
        '<option value="gemini"' + (c.provider === 'gemini' ? ' selected' : '') + '>Gemini Vision (Google)</option>' +
        '</select></div>' +
        '<div class="field"><label class="field-label">API Key (leave blank to keep)</label>' +
        '<input name="api_key" type="password" class="field-input field-input--boxed" placeholder="••••••••"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">Model</label>' +
        '<input name="model" class="field-input field-input--boxed" value="' + HM.format.esc(c.model || '') + '" placeholder="e.g. claude-opus-4-5, gpt-4o"></div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Analysis Settings · 分析設定</div>' +
        '<div class="field-grid field-grid--2">' +
        '<div class="field"><label class="field-label">Confidence Threshold (%)</label>' +
        '<input name="confidence_threshold" type="number" min="0" max="100" class="field-input field-input--boxed" value="' + (c.confidence_threshold || 70) + '"></div>' +
        '<div class="field"><label class="field-label">Max Retries</label>' +
        '<input name="max_retries" type="number" min="0" max="5" class="field-input field-input--boxed" value="' + (c.max_retries || 2) + '"></div>' +
        '</div>' +
        '<div class="field"><label class="field-label">System Prompt</label>' +
        '<textarea name="system_prompt" class="field-input field-input--boxed" rows="4">' + HM.format.esc(c.system_prompt || 'You are a TCM practitioner analyzing a tongue image. Identify color, coating, shape, and suggest constitution type.') + '</textarea></div>' +
        '</div>' +

        '<div class="card mb-4">' +
        '<div class="card-title">Patient Report · 患者報告</div>' +
        '<div class="field"><label class="check-item"><input type="checkbox" name="show_raw" value="1"' + (c.show_raw ? ' checked' : '') + '> Show raw AI output to patients</label></div>' +
        '<div class="field"><label class="check-item"><input type="checkbox" name="require_doctor_review" value="1"' + (c.require_doctor_review ? ' checked' : '') + '> Require doctor review before showing report</label></div>' +
        '<div class="field"><label class="check-item"><input type="checkbox" name="include_kb_references" value="1"' + ((c.include_kb_references !== false) ? ' checked' : '') + '> Include knowledge base references</label></div>' +
        '<div class="field"><label class="field-label">Disclaimer Text · 免責聲明</label>' +
        '<textarea name="disclaimer" class="field-input field-input--boxed" rows="3">' + HM.format.esc(c.disclaimer || 'This AI-generated analysis is for reference only and does not replace professional medical diagnosis.') + '</textarea></div>' +
        '</div>' +

        '<div data-general-error class="alert alert--danger" style="display:none;"></div>' +
        '<button type="submit" class="btn btn--primary">Save Configuration</button>' +
        '</form>';

      var form = document.getElementById('tc-form');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var d = HM.form.serialize(form);
        if (!d.api_key) delete d.api_key;
        HM.form.setLoading(form, true);
        try {
          await HM.api.admin.setTongueConfig(d);
          HM.form.setLoading(form, false);
          HM.ui.toast('Configuration saved · 配置已保存', 'success');
        } catch (err) {
          HM.form.setLoading(form, false);
          HM.form.showGeneralError(form, err.message || 'Failed');
        }
      });
    } catch (e) { HM.state.error(body, e); }
  }

  HM.adminPanels.tongueConfig = { render: render };
})();
