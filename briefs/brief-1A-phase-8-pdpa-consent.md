# Brief 1A Phase 8 — PDPA consent UI + privacy policy

**Priority:** P0 — pre-launch legal compliance
**Estimated effort:** 2-3 hrs Claude Code + ~1 hr USER review of legal copy
**Depends on:** Brief 1A Phase 3 (consent_text + consented_at columns exist), Phase 5 (delete + restore endpoints)
**Blocks:** Soft launch (PDPA non-negotiable)

---

## Goal

Capture explicit, informed consent before EVERY tongue image upload, in
compliance with **Malaysia PDPA 2010** (Personal Data Protection Act),
with clear disclosure of:
- What data is collected (tongue image)
- Why (AI-assisted TCM constitution analysis)
- Where it's processed (Anthropic Claude Vision in the US — cross-border transfer disclosure)
- Where it's stored (Cloudflare R2)
- Retention policy (7-day undo window, then patient-controlled)
- Right of erasure (delete-all endpoint exists; expose UI for it)

Plus a published privacy policy page reachable from any consent surface.

---

## ⚠️ CRITICAL: USER REVIEW REQUIRED

**This brief contains DRAFT LEGAL COPY.** All language wrapped in
`[USER REVIEW]` markers needs your eyeballs (and ideally a Malaysian
lawyer's) before going live. Anthropic AI is not your lawyer.

Specifically requiring review:
1. The consent checkbox text (legally binding once a patient checks it)
2. The privacy policy text (filed with PDPC if you ever face a complaint)
3. The cross-border transfer disclosure (US-based AI processing)
4. The retention policy specifics (7 days vs other defensible windows)
5. The "right of erasure" copy
6. Any references to Malaysia's PDPA Section 7 (consent), Section 5 (sensitive data), Section 39 (cross-border)

**DO NOT SHIP THIS PHASE until reviewed.** I've structured the brief so
the technical scaffolding is complete and the LEGAL copy is clearly
flagged for your input.

---

## Pre-flight (do BEFORE writing code, REPORT findings)

A. Find existing privacy/terms pages in v2:
   - `v2/privacy.html` or `v2/terms.html` if they exist — read them
   - Check `v2/components/footer*.html` for existing privacy links
   - Report what's there vs what needs creating

B. Find the patient registration flow:
   - Look in `v2/assets/js/panels/patient/register.js` or `auth.js`
   - Identify if there's an existing T&C checkbox at registration
   - We'll piggyback on that pattern for consistency

C. Check the AI Wellness Assessment intro screen (already seen — `ai-diagnosis.js` `renderIntro()`):
   - Confirm it's the right place to inject the first-time consent modal
   - Does it have a "Start" button? That's the trigger

D. Check what happens if a patient has already consented once:
   - We don't want to nag every upload — store consent in localStorage AND in the row's `consent_text` field
   - Confirm `consent_text` and `consented_at` are still in `$fillable` on the model

REPORT findings A-D before writing code.

---

## Phase 8 scope (after pre-flight)

### Part 1 — Consent modal component

Create `v2/assets/js/components/consent-modal.js`:

```js
/**
 * HansMed PDPA consent modal.
 *
 * Shown BEFORE the first tongue upload. Patient must explicitly check
 * the consent checkbox to proceed. Stores the version + timestamp in
 * localStorage so subsequent uploads in the same session don't re-prompt.
 *
 * The exact consent_text the patient agreed to is also passed through
 * to the backend's start-upload endpoint, so the row gets a complete
 * legal evidence trail (text + timestamp).
 *
 * Versioning: bump CONSENT_VERSION whenever the legal copy changes.
 * Patients with an older version stored will be re-prompted automatically.
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  // [USER REVIEW] — bump this when consent copy changes.
  // Format: ISO date of last legal review.
  var CONSENT_VERSION = '2026-05-05';
  var STORAGE_KEY     = 'hm-tongue-consent-v' + CONSENT_VERSION;

  // [USER REVIEW] — the EXACT text patients are agreeing to.
  // Storing this verbatim means we can prove later what they saw.
  var CONSENT_TEXT_EN = [
    'I consent to HansMed Modern TCM collecting and processing my tongue photograph',
    'for the purpose of AI-assisted Traditional Chinese Medicine constitution analysis.',
    '',
    'I understand and acknowledge that:',
    '• My tongue image will be transmitted to Anthropic, Inc. (Claude AI, United States)',
    '  for analysis. This involves a cross-border transfer of my personal data.',
    '• The United States may not provide the same level of personal data protection as',
    '  Malaysian law. By proceeding, I explicitly consent to this transfer and processing.',
    '• My image is stored on Cloudflare R2 secure storage.',
    '• HansMed does not control third-party data handling beyond their published policies.',
    '• I may delete individual assessments. Images are permanently deleted from storage',
    '  after the applicable retention period.',
    '• I may request deletion of my data at any time; however, certain records may be',
    '  retained where required for legal, regulatory, or clinical audit purposes.',
    '• AI analysis is for informational purposes only and does not replace professional',
    '  medical diagnosis. A licensed practitioner may review results where applicable.',
    '',
    'HansMed acts as a data user under applicable Malaysian data protection laws.',
    '',
    'I have read the Privacy Policy and voluntarily consent to the above.',
  ].join('\n');

  // [USER REVIEW] — Chinese translation. Should be reviewed by a
  // bilingual reviewer (ideally with legal context). Direct translation
  // of legal terms doesn't always carry the same legal weight.
  var CONSENT_TEXT_ZH = [
    '本人同意 HansMed 漢方現代中醫收集及處理本人之舌頭照片，',
    '用於 AI 輔助中醫體質分析。',
    '',
    '本人理解並確認：',
    '• 本人之舌頭照片將傳送至美國 Anthropic 公司（Claude AI）進行分析，',
    '  此為個人資料之跨境傳輸。',
    '• 美國之個人資料保護水平可能未必與馬來西亞法律相同，',
    '  本人明確同意該等傳輸及處理。',
    '• 照片將儲存於 Cloudflare R2 安全儲存系統。',
    '• HansMed 對第三方之資料處理僅限於其公開政策範圍內，無法完全控制。',
    '• 本人可刪除個別評估，照片將於適用保留期限後永久刪除。',
    '• 本人可隨時要求刪除資料，但在符合法律、監管或臨床審計要求下，',
    '  部分資料可能需要保留。',
    '• AI 分析僅供參考，不能取代專業醫療診斷，必要時由執業醫師審閱。',
    '',
    '本人已閱讀隱私政策，並自願同意以上條款。',
  ].join('\n');

  /**
   * Open the consent modal.
   * @param {Object} opts
   * @param {Function} opts.onAccept - called with consent_text string when
   *                                   patient ticks the box and clicks Continue
   * @param {Function} opts.onCancel - called if patient closes / cancels
   */
  function open(opts) {
    opts = opts || {};

    // Modal markup with EN/中 dual-pane (lang-switcher.js handles visibility)
    var html =
      '<div class="hm-consent-backdrop" id="hm-consent-bd">' +
      '<div class="hm-consent-modal" role="dialog" aria-modal="true" aria-labelledby="hm-consent-title">' +
      '<h2 id="hm-consent-title">' +
      '<span lang="en">Privacy Notice — Tongue Image Upload</span>' +
      '<span lang="zh">隱私聲明 — 舌頭照片上載</span>' +
      '</h2>' +
      '<div class="hm-consent-body">' +
      '<pre lang="en" class="hm-consent-text">' + escapeHtml(CONSENT_TEXT_EN) + '</pre>' +
      '<pre lang="zh" class="hm-consent-text" style="font-family:var(--font-zh);">' + escapeHtml(CONSENT_TEXT_ZH) + '</pre>' +
      '</div>' +
      '<div class="hm-consent-links">' +
      '<a href="/v2/privacy.html" target="_blank">' +
      '<span lang="en">Read full Privacy Policy →</span>' +
      '<span lang="zh">閱讀完整隱私政策 →</span>' +
      '</a>' +
      '</div>' +
      '<label class="hm-consent-check">' +
      '<input type="checkbox" id="hm-consent-cb"> ' +
      '<span lang="en">I have read and consent to the above.</span>' +
      '<span lang="zh">本人已閱讀並同意以上條款。</span>' +
      '</label>' +
      '<div class="hm-consent-actions">' +
      '<button type="button" class="btn btn--ghost"   id="hm-consent-cancel">' +
      '<span lang="en">Cancel</span><span lang="zh">取消</span></button>' +
      '<button type="button" class="btn btn--primary" id="hm-consent-ok" disabled>' +
      '<span lang="en">Continue</span><span lang="zh">繼續</span></button>' +
      '</div>' +
      '</div></div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    injectStyle();

    var cb     = document.getElementById('hm-consent-cb');
    var okBtn  = document.getElementById('hm-consent-ok');
    var cancel = document.getElementById('hm-consent-cancel');
    var bd     = document.getElementById('hm-consent-bd');

    cb.addEventListener('change', function () { okBtn.disabled = !cb.checked; });
    cancel.addEventListener('click', function () {
      close();
      if (opts.onCancel) opts.onCancel();
    });
    okBtn.addEventListener('click', function () {
      // Persist locally to avoid re-prompting in this browser
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version:    CONSENT_VERSION,
          consented:  new Date().toISOString(),
        }));
      } catch (_) {}

      // Determine which language the user was actually viewing
      var lang = document.documentElement.getAttribute('lang') === 'zh' ? 'zh' : 'en';
      var text = lang === 'zh' ? CONSENT_TEXT_ZH : CONSENT_TEXT_EN;

      close();
      if (opts.onAccept) opts.onAccept(text);
    });
  }

  function close() {
    var bd = document.getElementById('hm-consent-bd');
    if (bd) bd.remove();
  }

  /** Returns true if the user has already consented to the current version. */
  function hasConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return parsed && parsed.version === CONSENT_VERSION;
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function injectStyle() {
    if (document.getElementById('hm-consent-style')) return;
    var s = document.createElement('style');
    s.id = 'hm-consent-style';
    s.textContent =
      '.hm-consent-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);' +
      'display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;}' +
      '.hm-consent-modal{background:var(--bg);max-width:560px;width:100%;max-height:90vh;' +
      'overflow:auto;border-radius:var(--r-lg);padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.3);}' +
      '.hm-consent-modal h2{margin:0 0 16px;font-size:1.1rem;}' +
      '.hm-consent-text{white-space:pre-wrap;font-family:inherit;font-size:.9rem;line-height:1.55;' +
      'background:var(--washi);padding:14px;border-radius:var(--r-md);margin:0 0 12px;}' +
      '.hm-consent-links{margin:8px 0 16px;font-size:.85rem;}' +
      '.hm-consent-check{display:flex;align-items:flex-start;gap:8px;margin:12px 0;font-size:.9rem;}' +
      '.hm-consent-check input{margin-top:3px;}' +
      '.hm-consent-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}';
    document.head.appendChild(s);
  }

  HM.consentModal = {
    open:       open,
    hasConsent: hasConsent,
    version:    CONSENT_VERSION,
    text:       function (lang) { return lang === 'zh' ? CONSENT_TEXT_ZH : CONSENT_TEXT_EN; },
  };
})();
```

### Part 2 — Wire consent into upload flow

Modify `v2/assets/js/api.js` `uploadTongue()` (just shipped in Phase 6) to
include `consent_text` in the start-upload payload:

```js
// In uploadTongue, before calling start-upload:
var consentText = (window.HM && HM.consentModal && HM.consentModal.hasConsent())
  ? HM.consentModal.text(document.documentElement.getAttribute('lang') || 'en')
  : null;

// Update the start-upload call:
sign = await api.post('/patient/tongue-assessments/start-upload', {
  filename:     file.name,
  file_size:    file.size,
  consent_text: consentText,   // <-- send the text the patient agreed to
}, { timeout: 10000 });
```

### Part 3 — Show consent modal on first upload

In `v2/assets/js/panels/patient/ai-diagnosis.js`, modify the
"Take photo" button handler (~line 148):

```js
document.getElementById('aid-tongue-open').addEventListener('click', function () {
  // PDPA: gate the camera open behind consent. If patient already
  // consented to the current version, skip straight to capture.
  if (HM.consentModal.hasConsent()) {
    HM.tongueCapture.open({ onCapture: function (file) { handleTongueFile(file); } });
    return;
  }
  HM.consentModal.open({
    onAccept: function (consentText) {
      // After consent, immediately open the capture flow so the
      // patient doesn't lose momentum.
      HM.tongueCapture.open({ onCapture: function (file) { handleTongueFile(file); } });
    },
    onCancel: function () { /* nothing — patient closed the modal */ },
  });
});
```

Same change in `v2/assets/js/panels/patient/tongue.js` if it has its own
"open camera" button.

### Part 4 — Privacy Policy page

Create `v2/privacy.html` (full standalone page using same v2 layout as
existing pages like `terms.html`). Copy template:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Privacy Policy · 隱私政策 · HansMed Modern TCM</title>
  <!-- match existing v2 head includes -->
</head>
<body>
  <!-- match existing v2 nav header -->

  <main class="container" style="max-width:760px;padding:32px 16px;">
    <h1>
      <span lang="en">Privacy Policy</span>
      <span lang="zh">隱私政策</span>
    </h1>
    <p class="text-muted">
      <span lang="en">Last updated: 2026-05-05 · Effective: 2026-05-05</span>
      <span lang="zh">最後更新：2026 年 5 月 5 日 · 生效日期：2026 年 5 月 5 日</span>
    </p>

    <!-- [USER REVIEW] / [LAWYER REVIEW] — every section below needs sign-off -->

    <section>
      <h2><span lang="en">1. Who we are</span><span lang="zh">1. 我們是誰</span></h2>
      <p lang="en">
        HansMed Modern TCM is a Malaysian telehealth platform offering AI-assisted
        Traditional Chinese Medicine constitution assessment, doctor consultations,
        and herbal product recommendations. Our registered office is at
        [USER REVIEW: insert legal address].
      </p>
      <p lang="zh" style="font-family:var(--font-zh);">
        漢方現代中醫為馬來西亞遠程醫療平台，提供 AI 輔助中醫體質評估、
        醫師諮詢及中藥產品推薦。註冊辦事處：[USER REVIEW：插入合法地址]。
      </p>
    </section>

    <section>
      <h2><span lang="en">2. What data we collect</span><span lang="zh">2. 收集資料</span></h2>
      <ul lang="en">
        <li>Account information (name, email, phone, date of birth)</li>
        <li>Health information you provide (questionnaires, symptoms, consultation notes)</li>
        <li><strong>Tongue images</strong> — when you use AI Wellness Assessment</li>
        <li>Appointment + transaction records</li>
        <li>Standard web analytics (page views, device type) — see Section 8</li>
      </ul>
      <ul lang="zh" style="font-family:var(--font-zh);">
        <li>帳戶資料（姓名、電郵、電話、出生日期）</li>
        <li>您提供的健康資料（問卷、症狀、診症紀錄）</li>
        <li><strong>舌頭照片</strong> — 使用 AI 健康評估時收集</li>
        <li>預約及交易紀錄</li>
        <li>標準網頁分析資料（瀏覽量、裝置類型）— 詳見第 8 節</li>
      </ul>
    </section>

    <section>
      <h2><span lang="en">3. How we use your tongue image</span><span lang="zh">3. 舌頭照片之使用</span></h2>
      <p lang="en">
        Tongue images are uploaded directly from your browser to encrypted storage
        (Cloudflare R2). The image is then transmitted to <strong>Anthropic, Inc.</strong>
        (Claude AI Vision API, located in the United States) for AI-assisted analysis.
      </p>
      <p lang="en">
        <strong>Cross-border transfer (PDPA):</strong>
        Your personal data will be transferred outside Malaysia to the United States.
        The United States may not provide the same level of data protection as
        Malaysian law. By using this service, you explicitly consent to this transfer.
      </p>
      <p lang="en">
        HansMed relies on Anthropic's published data handling policies for processing.
        HansMed does not control third-party systems beyond such policies and makes
        no independent guarantee regarding third-party data retention practices
        ([USER REVIEW: link to Anthropic's published commercial API data handling policy]).
      </p>
      <p lang="zh" style="font-family:var(--font-zh);">
        舌頭照片由您的瀏覽器直接上載至加密儲存（Cloudflare R2），
        然後傳送至美國 <strong>Anthropic 公司</strong>（Claude AI Vision API）進行 AI 輔助分析。
      </p>
      <p lang="zh" style="font-family:var(--font-zh);">
        <strong>跨境傳輸（PDPA）：</strong>
        您的個人資料將傳輸至馬來西亞境外（美國）。
        美國提供的資料保護水平可能與馬來西亞法律不同。
        使用本服務即表示您明確同意此項傳輸。
      </p>
      <p lang="zh" style="font-family:var(--font-zh);">
        HansMed 依據 Anthropic 公開之資料處理政策進行傳送。
        HansMed 對第三方系統的控制僅限於此等政策範圍內，
        對第三方資料保留做法不作獨立保證
        （[USER REVIEW：連結至 Anthropic 商業條款]）。
      </p>
    </section>

    <section>
      <h2><span lang="en">4. Retention &amp; deletion</span><span lang="zh">4. 保留與刪除</span></h2>
      <p lang="en">
        After a tongue assessment is uploaded:
      </p>
      <ul lang="en">
        <li><strong>Individual deletion:</strong> When you delete an assessment,
            it is immediately removed from your active view. The associated image
            is permanently deleted from storage after a defined retention window
            (currently 7 days, recoverable from "Recently Deleted" within that window).</li>
        <li><strong>Right of erasure:</strong> You may request deletion of your
            tongue data at any time via the platform (Settings → Privacy →
            Delete All My Tongue Data).</li>
        <li><strong>Legal and clinical retention:</strong> Notwithstanding the above,
            HansMed may retain certain records (including analysis results,
            consultation notes, or audit logs) where required to comply with
            applicable laws, regulatory requirements, or clinical audit obligations
            ([USER REVIEW: confirm retention period with Malaysian healthcare regulator —
            typically 5-7 years for medical records]).</li>
      </ul>
      <ul lang="zh" style="font-family:var(--font-zh);">
        <li><strong>個別刪除：</strong> 刪除評估後立即從您的活動檢視畫面移除，
            相關照片將於適用保留期限（目前為 7 日）後永久刪除；
            期內可於「最近刪除」恢復。</li>
        <li><strong>刪除權：</strong> 您可隨時透過平台要求刪除您的舌診資料
            （設定 → 隱私 → 刪除所有舌診資料）。</li>
        <li><strong>法律及臨床保留：</strong> 無論上述如何，
            HansMed 在符合驅用法律、監管要求或臨床審計義務的情況下，
            可能保留某些記錄（包括分析結果、諮問紀錄或審計日誌）
            （[USER REVIEW：向馬來西亞醫療監管確認保留期限 — 醫療記錄通常為 5-7 年）。</li>
      </ul>
    </section>

    <!-- Sections 5-12 templated similarly: -->
    <!-- 5. Your rights (PDPA Section 30 — access, correct, withdraw) -->
    <!-- 6. Security (Cloudflare R2 encryption at rest, HTTPS in transit, Sanctum auth) -->
    <!-- 7. Cookies and analytics -->
    <!-- 8. Children (no patients under 18 without guardian consent) -->
    <!-- 9. Changes to this policy -->
    <!-- 10. Contact (Data Protection Officer email — [USER REVIEW]) -->
    <!-- 11. Complaints (PDPC Malaysia route) -->
    <!-- 12. Governing law (Malaysia) -->

    <p class="text-muted" style="margin-top:32px;">
      <em>This Privacy Policy was last reviewed on 2026-05-05.</em>
    </p>
  </main>

  <!-- match existing v2 footer -->
</body>
</html>
```

### Part 5 — "Delete All My Tongue Data" UI

In Settings/Privacy panel (location TBD per pre-flight), add a button
that confirms via 2-step prompt and calls `DELETE /api/patient/tongue-assessments`
with the `confirm: 'DELETE_ALL_MY_TONGUE_DATA'` token from Phase 5.

This requires extending `api.js` `delete()` method to accept a body:

```js
// In api.js
delete: function (p, body) { return request('DELETE', p, body); },

// New method:
deleteAllTongueAssessments: function () {
  return api.delete('/patient/tongue-assessments', {
    confirm: 'DELETE_ALL_MY_TONGUE_DATA'
  });
},
```

UI scaffold (place in patient settings panel):

```js
function renderPrivacySection(container) {
  container.innerHTML =
    '<div class="card card--bordered" style="border-left:3px solid var(--red-seal);">' +
    '<h3><span lang="en">Privacy controls</span><span lang="zh">隱私設定</span></h3>' +
    '<p class="text-sm text-muted">' +
    '<span lang="en">Permanently delete all tongue images you have uploaded. ' +
    'This action is irreversible.</span>' +
    '<span lang="zh">永久刪除您上載的所有舌頭照片。此操作不可逆。</span>' +
    '</p>' +
    '<button class="btn btn--danger" id="hm-delete-all-tongue">' +
    '<span lang="en">Delete All My Tongue Data</span>' +
    '<span lang="zh">刪除所有舌診資料</span>' +
    '</button></div>';

  document.getElementById('hm-delete-all-tongue').addEventListener('click', function () {
    var ok1 = confirm(
      'This will PERMANENTLY delete all your tongue images and assessments. ' +
      'This cannot be undone. Continue? · 此操作將永久刪除所有舌診資料，無法復原。是否繼續？'
    );
    if (!ok1) return;
    var typed = prompt(
      'Type DELETE to confirm. · 輸入 DELETE 確認。'
    );
    if (typed !== 'DELETE') {
      alert('Cancelled. · 已取消。');
      return;
    }
    HM.api.patient.deleteAllTongueAssessments()
      .then(function (r) {
        alert('Deleted ' + r.deleted_count + ' assessment(s). · 已刪除 ' + r.deleted_count + ' 筆評估。');
      })
      .catch(function (e) {
        alert('Failed: ' + (e.message || 'unknown error'));
      });
  });
}
```

---

## Acceptance criteria

After Phase 8 ships:

1. **First-time upload flow** — patient with no consent on file clicks "Take photo" → consent modal pops up → must check box to enable "Continue" → cannot upload until consent given
2. **Repeat upload (same browser)** — consent already in localStorage → modal does NOT show → straight to camera capture
3. **Consent text matches DB** — uploaded assessment has `consent_text` populated with the exact text patient saw, `consented_at` set to now()
4. **Privacy policy reachable** — `/v2/privacy.html` loads, all sections render bilingual, link from consent modal works
5. **Delete All flow** — patient navigates to Settings → Privacy → clicks Delete All → 2-step confirm → all tongue data soft-deleted + R2 objects purged + success message
6. **Consent versioning** — bumping CONSENT_VERSION in consent-modal.js causes all patients to re-consent on next upload (older localStorage key invalid)
7. **No regression** — existing patients who already uploaded assessments still see their history (their consent_text will be NULL but rows display fine)

---

## Smoke test

1. Open `https://hansmedtcm.com/v2/index.html` in incognito (no cached consent)
2. Log in as test patient
3. Navigate to AI Wellness Assessment → click "Take photo"
4. **Expected:** consent modal appears with EN/中 toggle, Continue disabled until checkbox ticked
5. Tick box → click Continue → camera capture flow opens
6. Upload a tongue image, complete the analysis
7. Reload page, click Take photo again → should go DIRECTLY to camera (no modal)
8. Open DB / portal → verify the new assessment row has `consent_text` populated
9. Navigate to Settings → Privacy → "Delete All My Tongue Data"
10. Type DELETE → confirm → all assessments gone from history view, R2 dashboard shows objects purged

---

## Commit message

```
feat(frontend): PDPA consent modal + privacy policy + delete-all UI (Brief 1A Phase 8)

- New consent modal component (HM.consentModal) shown before first
  tongue upload; localStorage caches per-version consent so repeats skip
- api.js uploadTongue passes consent_text to backend's start-upload
  endpoint, populating the legal evidence trail in tongue_assessments
- /v2/privacy.html — full bilingual privacy policy with PDPA Section 7,
  39 disclosures (cross-border, sensitive data) [LEGAL REVIEW PENDING]
- Settings → Privacy → "Delete All My Tongue Data" button with 2-step
  confirm → calls DELETE /tongue-assessments with confirmation token
  added in Phase 5

Brief: 1A Phase 8

⚠️  LEGAL COPY IN /v2/privacy.html AND consent-modal.js TEXTS NEED USER
    AND/OR LAWYER REVIEW BEFORE PRODUCTION SOFT LAUNCH.
```

---

## Risks

- 🔴 **Legal exposure if copy is wrong** — every PDPA disclosure must be accurate. Anthropic AI is not a lawyer. **MUST be reviewed by user and ideally a Malaysian lawyer.**
- 🟡 **Consent fatigue** — modal is shown on first upload only (localStorage cache), but if a patient clears cookies or uses a fresh device, they re-consent. Acceptable trade-off.
- 🟡 **Cross-border disclosure language** — the most legally-fraught section. Anthropic's actual data policy on Claude API inputs needs verifying ([USER REVIEW: link to Anthropic commercial terms].
- 🟢 **Delete All is reversible-NOT** — once you click it, R2 objects are gone immediately. The 2-step type-DELETE confirm is intentional friction.
- 🟢 **Backward compat** — existing patients with no consent record can still view their old assessments. They just can't UPLOAD a new one without consenting first.

---

## Out of scope (deferred)

- "Recently Deleted" list view (within the 7-day undo window) — Phase 8.5 follow-up if user demand surfaces
- Granular consent (separate toggles for AI vs storage vs cross-border) — keeps copy simpler at v1
- Cookie consent banner (PDPA doesn't strictly require, but EU GDPR style would be nice) — Phase 9 hardening
- Email a copy of the consent receipt to the patient — Phase 9 if requested

---

## What user must do before launch

1. ✅ Read DRAFT consent texts in this brief (CONSENT_TEXT_EN + CONSENT_TEXT_ZH)
2. ✅ Read DRAFT privacy policy sections (1-12)
3. ⚠️ Get a Malaysian lawyer to review (recommended; even a 1-hr consultation = ~RM 500-1500 typically)
4. ✅ Confirm legal address, DPO email, Anthropic policy link
5. ✅ Decide retention period for soft-deleted assessment metadata (5y? 7y? 10y? — varies by Malaysian healthcare reg interpretation)
6. ✅ Then approve CC to ship Phase 8 verbatim or with edits

**Until those reviews are done, Phase 8 is `git commit`'d on a feature
branch but NOT merged to master / deployed.**

---

## Rollback

```
git revert <commit-sha>
```

Reverting drops the consent modal — existing tongue uploads continue
to work without consent capture. **This is legally risky** so
rollback should be considered emergency-only and replaced with
a fix-forward as fast as possible.
