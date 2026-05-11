# Brief #2b — Body diagram silhouette + case-history modal style polish

## Background

After Brief #2 shipped, the body diagram now renders in the patient case-history view, BUT only the doctor's drawings appear — the human silhouette template behind them is missing. The silhouette in the live consult view comes from `<img>` tags layered behind the drawing canvas (`assets/img/front.png` and `assets/img/back.png`); `captureBodyDiagrams()` in `v2/assets/js/panels/doctor/consult.js:895-909` only exports canvas pixels, so the silhouette never makes it into `case_record.body_combined`.

User has chosen the long-term path: bake the silhouette in on save going forward, AND display historical drawing-only rows with a layered silhouette fallback. Self-contained images matter for medical records (PDF export, archival, future template redesigns).

## TASK A — Body diagram silhouette (Option C: save-side bake + display-side fallback)

### Save-side change in `v2/assets/js/panels/doctor/consult.js`

Modify `captureBodyDiagrams()` (around line 895) so that, before exporting the canvas as base64, it composites the silhouette image(s) underneath the drawing onto a temporary canvas, then exports that merged result.

The current setup is a "combined" stage — `front.png` and `back.png` shown side-by-side behind a single canvas (`data-side="combined"`, dimensions 1400x1600). Find the stage element (`.body-combined-stage` at consult.js:619) and read the silhouette img positions/sizes from the layout, OR simply draw front + back at known proportions of the combined canvas (front on left half, back on right half).

Simplest implementation:
1. Create an `Image()` for `assets/img/front.png` and one for `assets/img/back.png`. Use `await new Promise(...)` on `onload` so the images are decoded before exporting.
2. Create a temp `<canvas>` matching the source canvas size.
3. Draw front image to the left half, back image to the right half of the temp canvas.
4. Draw the source canvas on top.
5. Export `tempCanvas.toDataURL('image/png')` as the new value.

Because this is async, `captureBodyDiagrams()` and its callers (`saveDraft`, `completeConsult`) need to be made async. Verify the callers `await` it correctly.

**Don't overwrite the existing `body_combined` field — write to a NEW field name** so historical drawing-only rows are still recognizable:

```js
out['body_combined_baked'] = mergedDataURL;
```

Keep writing the old `body_combined` value as well (drawing-only) for one transition release so any client running stale JS doesn't break. Mark it deprecated with a comment.

### MANDATORY SAFEGUARDS (don't skip these)

**Safeguard 1 — Silhouette load timeout + graceful degrade.** Wrap each `Image()` load in a Promise with a 5-second timeout and an `onerror` handler. If either silhouette image fails to load (CSP, CORS, missing file, slow network), do NOT write `body_combined_baked`. Instead, log a `console.warn` and write only the legacy drawing-only `body_combined`. The display-layer fallback (Task A display side) will then layer the silhouette at render time. Half-baked data must never be written.

```js
function loadSilhouette(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var timer = setTimeout(function () { reject(new Error('silhouette load timeout: ' + src)); }, 5000);
    img.onload = function () { clearTimeout(timer); resolve(img); };
    img.onerror = function () { clearTimeout(timer); reject(new Error('silhouette load error: ' + src)); };
    img.src = src;
  });
}
```

**Safeguard 2 — Type guard at the save boundary.** Right before `caseRecord[k] = bodyDiagrams[k]` (or wherever the captured value is assigned to the payload), throw if the value isn't a real data-URL string. This catches a missed `await` (would yield `[object Promise]`) or any future bug that produces a bad value, surfacing it loudly instead of corrupting the DB:

```js
var bodyDiagrams = await captureBodyDiagrams();
Object.keys(bodyDiagrams).forEach(function (k) {
  var v = bodyDiagrams[k];
  if (typeof v !== 'string' || v.indexOf('data:image/') !== 0) {
    throw new Error('captureBodyDiagrams produced invalid value for ' + k + ' (typeof=' + typeof v + ')');
  }
  caseRecord[k] = v;
});
```

**Safeguard 3 — Verify all call sites of captureBodyDiagrams.** Before pushing, run a grep for `captureBodyDiagrams(` and confirm every call uses `await`. List the call sites in the report.

### Display-side change in `v2/assets/js/panels/doctor/patients.js`

In both render locations (detail card around lines 408-433 and modal around lines 786-794):

1. If `cr.body_combined_baked` is present, render it as a single image — it already has silhouette + drawings composited. Same as the current rendering.
2. Else if `cr.body_combined` is present (drawing-only legacy), render it layered: a wrapper div with `front.png` + `back.png` as a CSS background or layered img tags, with the saved drawing img absolute-positioned on top.
3. Else fall back to `body_front` / `body_back` (existing behavior).

The layered fallback for legacy rows can use:

```html
<div class="body-history-stage" style="position:relative; display:inline-block;">
  <img src="assets/img/front.png" style="height:200px; width:auto;" />
  <img src="assets/img/back.png"  style="height:200px; width:auto;" />
  <img src="<body_combined data-url>" style="position:absolute; top:0; left:0; height:200px; width:auto; pointer-events:none;" />
</div>
```

Adjust `height` for the small thumbnail (96px) and the modal (200px). Make the wrapper itself the click target so the user can still open the diagram fullscreen.

## TASK B — Visual style alignment (Option E)

The case-history modal in `patients.js` (around lines 697-820) renders fields functionally but visually doesn't match the live consult page. Goal: bring the modal closer to the consult-page look without a full refactor.

1. Read the consult page's case-record markup at `consult.js:caseRecordMarkup()` (around line 510). Note its label typography, field spacing, color accents, dividers.
2. Update the modal's field rendering helper (`f(label, labelZh, value)` at line 725) and the surrounding container to echo that visual language. Specifically: label style, font sizes, spacing rhythm, the section divider lines, any color accents.
3. Don't merge the two render functions yet — that's a future refactor (would be Brief #2c). Just style-match.

Keep the "not recorded" placeholder behavior — it's useful for the doctor to see which fields were intentionally left blank.

## ACCEPTANCE CRITERIA

- Save a brand new consult with body diagram drawings → reopen the patient case history → silhouette + drawings render together as one image. Confirmed by hard-refresh + click into the new appointment.
- Open the case history of appointment 20 (a historical drawing-only row) → silhouette renders behind the existing drawings via the layered fallback. Drawings still visible, silhouette visible behind them.
- Modal field typography / spacing now visually echoes the consult page (subjective but recognizable).
- No regressions on chief complaint, treatments, prescription, body marks, documents, doctor notes.
- `saveDraft()` and `completeConsult()` still complete successfully now that the underlying capture is async — confirm with a draft save and a final-issue save.
- All three Mandatory Safeguards above are implemented: silhouette load timeout, save-boundary type guard, and verified call-site grep for `captureBodyDiagrams(`.
- Confirm by inspecting the resulting `body_combined_baked` data-URL size after a successful save: should be markedly larger (~50-150KB) than a drawing-only `body_combined` (~5-30KB). If similar in size, the silhouette didn't bake in — investigate before declaring success.

## REPORT BACK

```
Task A:
  Files changed: [paths + line numbers]
  Pushed to: [branch / commit hash]
  New saves include silhouette: [yes/no, how verified]
  Historical row appointment 20 shows silhouette via fallback: [yes/no]
  Async refactor of saveDraft / completeConsult preserved: [yes/no, what tested]

Task B:
  Files changed: [paths + line numbers]
  Style elements changed: [list — labels, spacing, dividers, etc.]
  Side-by-side visual check vs consult page: [done / not done]
```

If during Task A you find that making the capture async breaks something subtle in `completeConsult` (e.g. error handling, the rxStockError flow), STOP and report — I want to design that.
