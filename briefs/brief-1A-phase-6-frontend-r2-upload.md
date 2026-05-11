# Brief 1A Phase 6 — Frontend direct-to-R2 upload

**Priority:** P0 — last user-facing wiring before launch
**Estimated effort:** 1-2 hrs Claude Code
**Depends on:** Brief 1A Phase 5 (shipped — soft-delete + restore + cron live)
**Blocks:** End-to-end production E2E smoke test

---

## Goal

Replace the existing multipart `POST /api/patient/tongue-assessments` upload
with the new direct-to-R2 flow: browser fetches a presigned URL, PUTs the
image straight to R2, then notifies the backend. Server bandwidth + Railway
egress drop to near zero per upload.

Same external API surface — `HM.api.patient.uploadTongue(file)` keeps the
same signature and return shape. Call sites in `ai-diagnosis.js` and
`tongue.js` should not need changes (just re-test after).

---

## Pre-flight findings (already done — no need to re-do in Phase 6)

| | |
|---|---|
| api.js wrapper location | `v2/assets/js/api.js` lines 81-87 (`api.get/post/put/delete`) |
| `request()` core | lines 22-79 — handles auth header, FormData vs JSON body, timeout via AbortController |
| Existing `uploadTongue(file)` | api.js lines 174-181 — does multipart POST, 90s timeout |
| Call site #1 | `v2/assets/js/panels/patient/ai-diagnosis.js` line 175 — consumes `res.diagnosis` with `id`, `status`, full diagnosis fields |
| Call site #2 | `v2/assets/js/panels/patient/tongue.js` line 128 — same pattern |
| Polling fallback | `pollTongueAnalysis()` in ai-diagnosis.js line 240 — calls `getDiagnosis(id)` every 3s, max 40 attempts |
| Backend endpoints (Phase 3) | `POST /api/patient/tongue-assessments/start-upload` + `POST /api/patient/tongue-assessments/{id}/complete-upload` |
| `api.delete()` limitation | Doesn't take a body — needs extension for `deleteAll` (Phase 8 concern, NOT this brief) |

---

## Files to modify

1. **`E:\Hansmed-system\v2\assets\js\api.js`** — replace internals of `uploadTongue(file)`. Add no new exposed methods in this brief.

That's it. ONE file. The call sites stay unchanged.

---

## Required change

In `v2/assets/js/api.js`, find the existing `uploadTongue` method (lines 174-181):

### BEFORE

```js
uploadTongue: function (file) {
  var fd = new FormData();
  fd.append('image', file);
  // Backend runs the Claude Vision call inline in this request, so allow
  // up to 90s — image fetch + AI round-trip usually lands in 10–20s but
  // slow mobile uploads + cold-start backends can occasionally stretch.
  return api.post('/patient/tongue-assessments', fd, { timeout: 90000 });
},
```

### AFTER

```js
uploadTongue: async function (file) {
  // Brief 1A Phase 6 — direct browser-to-R2 upload.
  // Three steps: (1) ask backend for a presigned R2 PUT URL, (2) PUT the
  // image bytes directly to R2 (bypasses Railway entirely), (3) tell
  // backend "upload finished" so it verifies + runs Claude Vision sync.
  //
  // Net result: Railway sees only two small JSON requests instead of a
  // multipart upload, and the response shape is identical to the legacy
  // POST so handleTongueFile()/pollTongueAnalysis() stay unchanged.
  //
  // Legacy POST /patient/tongue-assessments still works on the backend —
  // we can fall back by reverting THIS function only.

  if (!file || !file.name) {
    var err = new Error('No file provided');
    err.status = 0;
    throw err;
  }

  // Validate MIME — backend regex accepts jpg/jpeg/png only. Catch
  // unsupported types here so the user gets a clear error before any
  // network call.
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (ext !== 'jpg' && ext !== 'png') {
    var et = new Error('Only JPG/PNG photos supported. · 僅支援 JPG/PNG 圖片。');
    et.status = 422;
    throw et;
  }

  // Step 1 — request presigned URL. 10s timeout because the backend
  // does a tiny DB insert + a few crypto ops; 10s is generous.
  var sign;
  try {
    sign = await api.post('/patient/tongue-assessments/start-upload', {
      filename:  file.name,
      file_size: file.size,
      // consent_text: omitted in Phase 6 — Phase 8 wires the consent UI.
      // Backend column is nullable; it'll just store NULL for these uploads.
    }, { timeout: 10000 });
  } catch (e) {
    // Surface backend validation errors verbatim (regex mismatch, size
    // out of range, auth, etc.) so handleTongueFile's existing error
    // mapper picks up status code + message correctly.
    throw e;
  }

  if (!sign || !sign.upload_url || !sign.assessment_id) {
    var es = new Error('start-upload response missing fields');
    es.status = 502;
    throw es;
  }

  // Step 2 — PUT to R2. R2 enforces the Content-Type from the signed
  // request, so we MUST send exactly sign.content_type back. 60s
  // timeout — generous for slow mobile networks; the file size is
  // already capped at 10 MB by the start-upload validation.
  //
  // We DO NOT use api.post/put here because the request goes to R2's
  // domain (not our backend), so the auth header / API_BASE prefix
  // would be wrong. Use plain fetch with our own AbortController.
  var putController = new AbortController();
  var putTimeout    = setTimeout(function () { putController.abort(); }, 60000);
  var putRes;
  try {
    putRes = await fetch(sign.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': sign.content_type },
      body:    file,
      signal:  putController.signal,
    });
    clearTimeout(putTimeout);
  } catch (e) {
    clearTimeout(putTimeout);
    var ep = new Error(
      e.name === 'AbortError'
        ? 'Upload to storage timed out. Please retry on a stable network.'
        : 'Upload to storage failed: ' + (e.message || 'network error')
    );
    ep.status = 0;
    throw ep;
  }
  if (!putRes.ok) {
    var er = new Error('R2 PUT rejected with HTTP ' + putRes.status);
    er.status = putRes.status;
    throw er;
  }

  // Step 3 — tell backend the PUT landed; backend verifies in R2,
  // flips image_url to the real key, runs Claude Vision sync, and
  // returns the full diagnosis. Same 90s ceiling as the legacy path
  // because this is where the AI call happens.
  var done;
  try {
    done = await api.post(
      '/patient/tongue-assessments/' + sign.assessment_id + '/complete-upload',
      {},                       // no body
      { timeout: 90000 }
    );
  } catch (e) {
    // If complete-upload fails, the row is in 'r2://pending' state and
    // the orphan-cleanup cron will eventually soft-delete it. Surface
    // the error to the user so they can retry; retrying creates a fresh
    // assessment_id (we don't reuse the failed one).
    throw e;
  }

  // Match the legacy response shape that the call sites expect:
  //   { diagnosis: <full row> }
  // The new endpoint returns { status, assessment_id, diagnosis }.
  // Wrap so handleTongueFile/tongue.js see the exact same envelope.
  return { diagnosis: done.diagnosis };
},
```

---

## Why no other files change

- **Call sites** consume `res.diagnosis` — unchanged
- **Polling fallback** uses `getDiagnosis(id)` — unchanged
- **Error rendering** in `handleTongueFile()` keys off `err.status` and `err.message` — the new function throws errors with the same shape
- **HM.tongueCapture** capture flow — unchanged (still produces a File object)
- **State management** (`state.tongueId`, `state.tongueReport`) — same shape

---

## Acceptance criteria

After deploy:

1. **Patient AI Wellness Assessment flow** — patient takes/picks tongue photo → upload progresses → analysis completes → constitution card renders with results. End-to-end same UX as before.
2. **Network tab** — instead of one large multipart POST, you see:
   - Small JSON POST to `/start-upload` (~500 B response)
   - PUT to `<account>.r2.cloudflarestorage.com/...` with the actual image bytes (200 OK)
   - Small JSON POST to `/complete-upload` (~5-10 KB response with diagnosis)
3. **Latency** — total user-perceived time should be **same or better** than before. The PUT to R2 is faster than PUT through Railway, but the AI call still dominates wall-clock.
4. **Error paths** still surface clean messages:
   - File >10 MB → 422 with "too large" message
   - File is a GIF/PDF/etc. → 422 with "JPG/PNG only" message
   - Network drop mid-PUT → user sees "Upload to storage timed out" or "Upload to storage failed"
   - Backend AI failure → status='failed' on diagnosis, doctor-review fallback message renders
5. **Legacy `POST /patient/tongue-assessments` (multipart)** — STILL WORKS for any client that hasn't refreshed. Phase 6 only touches the JS; the backend keeps both endpoints.
6. **No regression in `tongue.js`** — same upload pattern, same expected behavior.

---

## Risks

- 🟢 **Backward-compat is built in.** Backend's legacy `store()` endpoint is untouched. If Phase 6 JS has a bug, revert this one function and the legacy multipart POST works again.
- 🟡 **R2 CORS** — already configured in Phase 1 (allowed origins: hansmedtcm.com, www.hansmedtcm.com, hansmedtcm.github.io). If a patient hits the portal from any other origin, R2 will reject the PUT. Confirm CORS list still includes wherever the v2 portal is served from. **Action item:** if patient portal is served from `hansmedtcm.com/v2/...` we're fine. If from a different subdomain, add it via the artisan command (Phase 1's `r2:setup-cors` is idempotent).
- 🟡 **iOS Safari quirks** — `fetch()` with `body: file` works on iOS 14+. Older iOS may need `body: file.slice()` or a Blob wrap. If your support tickets show iOS upload failures post-launch, that's the first thing to check.
- 🟢 **Memory** — `body: file` streams the File without loading into memory, even for 10 MB images. No memory pressure on the browser.
- 🟢 **Auth** — start-upload + complete-upload are both authenticated patient routes (Sanctum), enforced by the backend middleware stack. PUT to R2 uses the signed URL's `X-Amz-Signature` for auth (not Sanctum) — that's correct, R2 has no idea who our patients are.

---

## Smoke test (run in browser DevTools after deploy)

1. Open `https://hansmedtcm.com/v2/index.html` (or wherever the patient portal lives)
2. Log in as a test patient
3. Navigate to AI Wellness Assessment
4. Open DevTools → Network tab
5. Click "Take photo" → take or upload a tongue JPG
6. Watch Network tab:
   - **Expected:** 3 requests in order:
     - `start-upload` (POST, status 201)
     - `<long-r2-domain>` (PUT, status 200)
     - `complete-upload` (POST, status 200)
   - **NOT expected:** old `tongue-assessments` multipart POST (status 202)
7. Verify the constitution card renders with the analysis result
8. Refresh page → check `Past Reports` section → the new assessment shows up

If any step fails, paste the failing request's response body + the browser console error.

---

## Commit message

```
feat(frontend): direct browser-to-R2 tongue upload (Brief 1A Phase 6)

Replaces the multipart POST /patient/tongue-assessments path with a
3-step direct-to-R2 flow:
  1. POST /start-upload → presigned R2 PUT URL + assessment_id
  2. PUT to R2 (bypasses Railway, no egress on the upload itself)
  3. POST /complete-upload → backend verifies + runs Claude Vision sync

External API surface unchanged — HM.api.patient.uploadTongue(file)
keeps the same signature and return shape, so the call sites in
ai-diagnosis.js and tongue.js need zero changes.

Backend's legacy multipart endpoint is preserved for backward compat
and as a 1-line revert path if anything regresses.

Brief: 1A Phase 6
```

---

## Out of scope (NOT in this brief)

- Adding `restore` and `deleteAll` API methods to api.js — Phase 7 (user-facing soft-delete UI)
- Extending `api.delete()` to accept a body — Phase 7
- "Recently Deleted" / Trash UI in the patient panel — Phase 7
- Consent UI / PDPA disclosure modal — Phase 8
- Privacy policy text — Phase 8
- Cron service registration on Railway dashboard — Phase 9

---

## Rollback

```
git revert <commit-sha>
```

Single commit, single function, single file. Cleanest possible rollback.
The legacy multipart endpoint never goes away during the transition.
