# Brief #2c — Body diagram aspect ratio + size match consult

## Background

After Brief #2b shipped, the body diagram now appears in the patient case history with silhouette + drawings baked in. Two issues remain:

1. **Drawing position doesn't match what was drawn.** The drawing canvas is internally 1400x1600 (aspect 0.875), but the consult page displays it at 200x430 CSS px (aspect 0.465). The CSS stretches the canvas vertically and squishes it horizontally during drawing. When `patients.js` then renders the saved PNG using `height:200px; width:auto` (no `object-fit`), the browser respects the PNG's natural 0.875 aspect, undoing the squish — strokes appear in a different position relative to the silhouette than during drawing.

2. **Body diagram in case history is too small.** Modal currently shows it at 200px height; consult page is 430px (desktop) / 350px (mobile).

Both are pure display-side fixes in `v2/assets/js/panels/doctor/patients.js`. No save-side or backend changes needed.

## TASK — Match consult page dimensions and aspect

In `patients.js`, the body diagram is rendered in two places. In **both**, replace the current `height:200px; width:auto` (modal) and `height:96px; width:auto` (detail card thumbnail) with a wrapper that locks the display to consult proportions and uses `object-fit: fill` so the saved PNG visually matches what was drawn.

### Detail card (around lines 408-433)

Use a smaller scale — half consult size — so the inline thumbnail stays compact in a list view:

```html
<a href="<image-url>" target="_blank" rel="noopener" title="Body diagram"
   style="display:inline-block; width:100px; height:215px; line-height:0;">
  <img src="<image-url>"
       style="width:100%; height:100%; object-fit:fill;
              border:1px solid var(--border); border-radius:var(--r-sm);
              background:#fff;">
</a>
```

100x215 = 0.465 aspect, the same proportions as consult, half the size for compact display. Apply to both the `body_combined_baked` branch and the legacy fallback (silhouette-layered) branch — the layered fallback's wrapper div should use the same dimensions.

### Modal (around lines 786-794)

Match consult exactly at desktop size, with mobile fallback:

```html
<a href="<image-url>" target="_blank" rel="noopener"
   style="display:inline-block; width:200px; height:430px; line-height:0;">
  <img src="<image-url>"
       style="width:100%; height:100%; object-fit:fill;
              border:1px solid var(--border); border-radius:var(--r-sm);
              background:#fff;">
</a>
```

Add a media query so on screens narrower than 768px the modal body diagram becomes 160x350 (consult mobile size). Easiest place is in the same inline style attribute or via a small style block injected near the modal root.

Same change applies to all three render paths in the modal: `body_combined_baked` (single image), `body_combined` legacy (layered silhouette + drawing), and the `body_front` / `body_back` legacy fallback (those are already side-by-side; keep their existing layout but bump each image to 200x430 too).

## ACCEPTANCE CRITERIA

- Open appointment 20's case history modal. The body diagram is now 200x430 px on desktop, the strokes line up with the silhouette in exactly the same positions you drew them in the live consult. Side-by-side comparison with the live consult page should show the same image (silhouette + drawings).
- On mobile (or browser narrowed under 768px), the modal body diagram is 160x350 px. Same alignment fidelity.
- The detail card body diagram thumbnail is 100x215 px, also showing strokes in correct positions, just smaller.
- All three render paths (`body_combined_baked`, `body_combined` legacy, `body_front`/`body_back` legacy) honor the new sizing.
- No regression on click-to-open: clicking the body diagram still opens the full saved image in a new tab.

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [branch / commit hash]
Tested by: [hard refresh + visual side-by-side check vs consult page]
Modal body diagram now 200x430 desktop / 160x350 mobile: [yes/no]
Detail card thumbnail now 100x215: [yes/no]
Drawing alignment matches live consult: [yes/no — say what comparison method you used]
```
