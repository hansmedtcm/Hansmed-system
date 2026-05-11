# Brief #2d — Body diagram: true 1:1 match with live consult

## Background

After Brief #2c shipped, body diagram still doesn't match the live consult — strokes appear in shifted positions and shapes look distorted. CEO compared screenshots and identified two stacked issues:

1. **Modal aspect ratio is wrong.** Brief #2c used 200x430 (aspect 0.465) with `object-fit: fill`. But the live consult stage uses `aspect-ratio: 7/8` (= 0.875) per `v2/assets/css/components.css:653`. Forcing 7:8 content into 0.465 distorts everything.

2. **Bake silhouette layout doesn't match live CSS.** The bake function in `consult.js:944-979` uses naive "fit-to-half" geometry. The live consult's `.body-combined-silhouettes` flex layout in `components.css:663-684` uses padding 3%/4%, gap 4%, max-width 42%, height 94%, object-fit:contain. So the silhouette ends up at different pixel positions on the saved PNG than where it appeared visually during drawing — strokes shift relative to the silhouette.

User has said "i dont mind you increase the size of the window like the blue colour drawing area" — so generous sizing is fine.

## TASK A — Fix bake silhouette positioning to match live CSS exactly

In `v2/assets/js/panels/doctor/consult.js`, `captureBodyDiagrams()` around lines 944-970 (the silhouette compositing block). Replace the current naive layout with one that mirrors `.body-combined-silhouettes` CSS exactly.

Reference CSS (from `v2/assets/css/components.css:663-684`):
- `.body-combined-silhouettes`: `padding: 3% 4%; gap: 4%; align-items: center; justify-content: space-around;`
- `.body-combined-img`: `height: 94%; max-width: 42%; object-fit: contain;`

Replace the silhouette positioning code with:

```js
var stageW = tmp.width;          // 1400
var stageH = tmp.height;         // 1600
var padH = stageW * 0.04;        // 4% horizontal
var padV = stageH * 0.03;        // 3% vertical
var gap  = stageW * 0.04;        // 4% between images
var innerW  = stageW - 2 * padH;
var innerH  = stageH - 2 * padV;
var colW    = (innerW - gap) / 2;
var maxImgW = stageW * 0.42;     // matches max-width: 42%
var imgH    = innerH * 0.94;     // matches height: 94%

[silhouettes[0], silhouettes[1]].forEach(function (sImg, idx) {
  // object-fit: contain — preserve aspect, fit within (maxImgW x imgH)
  var scale = Math.min(maxImgW / sImg.width, imgH / sImg.height);
  var w = sImg.width  * scale;
  var h = sImg.height * scale;
  var colStartX = padH + idx * (colW + gap);
  var x = colStartX + (colW - w) / 2;   // center horizontally in column
  var y = padV + (innerH - h) / 2;      // center vertically in inner area
  tctx.drawImage(sImg, x, y, w, h);
});
```

This produces silhouettes at exactly the same logical pixel positions as the live consult. Strokes drawn over the live silhouette will now align with the silhouette in the saved PNG.

Important: NEW saves only. Historical rows (including appointment 20) will keep their drawing-only `body_combined` and rely on the display-side fallback in `patients.js`.

## TASK B — Fix display sizing in case history (modal + detail card)

In `v2/assets/js/panels/doctor/patients.js`, replace the body diagram render in both locations with a 7:8 aspect ratio at generous size, and stop using `object-fit: fill`. The saved PNG already matches consult aspect; preserve it naturally.

### Modal (around lines 786-794)

Use `width: min(700px, 90vw)` and `aspect-ratio: 7 / 8` so it fills available space without distortion:

```html
<a href="<image-url>" target="_blank" rel="noopener"
   style="display:block; width:min(700px,90vw); aspect-ratio:7/8;
          margin:0 auto; line-height:0;">
  <img src="<image-url>"
       style="width:100%; height:100%; object-fit:contain;
              border:1px solid var(--border); border-radius:var(--r-sm);
              background:#fff;">
</a>
```

Apply the same 7:8 aspect to all three render branches in the modal:
1. `body_combined_baked` (single image)
2. `body_combined` legacy (silhouette-layered fallback — wrap the silhouette+drawing layered div in a 7:8 container)
3. `body_front`/`body_back` legacy (each image in its half of a 7:8 stage)

### Detail card thumbnail (around lines 408-433)

Use a smaller 7:8 box, generous enough to be readable but compact for list view:

```html
<a href="<image-url>" target="_blank" rel="noopener" title="Body diagram"
   style="display:inline-block; width:240px; aspect-ratio:7/8; line-height:0;">
  <img src="<image-url>"
       style="width:100%; height:100%; object-fit:contain;
              border:1px solid var(--border); border-radius:var(--r-sm);
              background:#fff;">
</a>
```

Apply to all three render branches in the detail card too.

### Mobile responsive

The live consult uses `aspect-ratio: 6/8` on screens ≤640px. Add a `@media (max-width: 640px)` rule that switches both the modal and detail card to `aspect-ratio: 6/8`. Width can be flexible (e.g. `min(400px, 95vw)` for modal, `200px` for detail card).

## ACCEPTANCE CRITERIA

- Save a brand new consult with body drawings → open the case history modal → silhouettes and strokes appear visually identical to what was drawn in the live consult, just rendered as a static image. No squishing, no stretching, strokes in correct positions on the silhouette.
- Modal body diagram is now generously sized (~700px wide on desktop) with proper 7:8 proportions.
- Detail card thumbnail (240px wide) shows the same image, scaled down, still proportionally correct.
- On viewports ≤640px, both views switch to 6:8 aspect to match consult mobile.
- Historical rows (e.g. appointment 20, drawing-only) still render via the silhouette-layered fallback at the new larger size — silhouette behind, drawing on top, both inside the 7:8 box.
- Click-to-open still works on all three render paths.

## REPORT BACK

```
Task A (bake fix):
  Files changed: [paths + line numbers]
  Pushed to: [commit hash]
  New saves verified: [yes/no — describe how, e.g. saved a fresh consult and inspected baked PNG]
  Silhouette pixel positions in baked PNG match live CSS positions: [yes/no]

Task B (display sizing):
  Files changed: [paths + line numbers]
  Pushed to: [commit hash]
  Modal at 7:8 aspect ~700px: [yes/no]
  Detail card at 7:8 aspect 240px: [yes/no]
  Mobile breakpoint (6:8 below 640px): [yes/no]
  All three render branches (baked, legacy combined, legacy front/back) updated: [yes/no]
  Historical row appointment 20 still works via layered fallback: [yes/no]
```

If during Task A you discover the bake math doesn't actually produce silhouettes matching the live CSS positions when you test, flag the discrepancy with specific pixel offsets — don't paper over with eyeballed adjustments.
