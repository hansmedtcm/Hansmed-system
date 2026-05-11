# Brief #2 — Patient case history viewer: body diagram missing

## Background

When a doctor opens the patient tab and views a past consultation's case history, the body diagram never renders, even when the consultation was saved with one. (The chief complaint, pulse, etc. now render correctly after Brief #1b, but body diagram doesn't show.)

## Root cause (already diagnosed by CEO)

The save code in `v2/assets/js/panels/doctor/consult.js` writes the body diagram as `case_record.body_combined` — a single combined canvas image stored as a base64 PNG. We confirmed this in a live API response: the value is present and correct in saved consultations.

But `v2/assets/js/panels/doctor/patients.js` only checks for `body_front` and `body_back` keys, which are dead — they're never written by the current save path. So the conditional render block evaluates false and the entire body-diagram section is silently skipped.

Affected code in `patients.js`:
- Line 344: `var hasBodyDiagram = !! (cr.body_front || cr.body_back);`
- Lines 407-416: inline render block in the patient detail card (small thumbnails)
- Lines 770-778: full case-record modal (large view)

## TASK

In both rendering locations (the patient detail card and the case-record modal), update the body-diagram display to:

1. Check `cr.body_combined` first. If present, render it as a single image with the label "Body Diagram · 身體圖示".
2. Fall back to `cr.body_front` and `cr.body_back` if `body_combined` is missing (defensive — handles any unknown historical row format).

### Suggested approach for each render block

**Detail card (lines 344, 407-416):**

Change the `hasBodyDiagram` flag at line 344 to:
```js
var hasBodyDiagram = !!(cr.body_combined || cr.body_front || cr.body_back);
```

Inside the render block at 407-416, render `body_combined` as a single 96px-tall thumbnail when present. Keep the front/back rendering as a fallback when `body_combined` is missing.

**Modal (lines 770-778):**

Same logic, but with the larger 200px sizing already used in the modal. Single combined image when `body_combined` is present, otherwise fall back to front/back side-by-side.

Use the same `<a href><img></a>` structure already used by the front/back rendering so clicking the diagram opens the full image in a new tab.

## ACCEPTANCE CRITERIA

- After hard-refresh, opening the patient tab and clicking into the case history modal of a consultation that has a body diagram (e.g. appointment 20 from earlier testing) shows the diagram with the doctor's drawings visible.
- The smaller inline thumbnail in the patient detail card also renders the diagram.
- A consultation with no body diagram still renders cleanly (no broken-image icon, no empty box).
- Clicking the diagram opens it full-size in a new tab.
- No regressions on chief complaint, pulse, BP, treatments, or prescription rendering — those all still display correctly.

## REPORT BACK

```
Files changed: [list with line numbers]
Pushed to: [branch / commit hash]
Tested by: [hard-refresh + click into appointment 20 case history]
Body diagram rendered correctly: [yes / no]
Detail card thumbnail rendered correctly: [yes / no]
Regressions checked: [what other fields you confirmed still render]
```
