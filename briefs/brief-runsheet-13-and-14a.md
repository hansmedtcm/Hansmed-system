# Combined Runsheet — Brief #13 (pricing) + Brief #14a (constitution card)

**Classification: WRAPPER / RUNSHEET — runs two pre-written briefs back-to-back with a single snapshot, single verification cycle, single commit. v2 stays the live app; v3 marketing site gets pricing finalised; doctor/patient panels get the constitution-card fix. No new task content here — full task definitions live in the two source briefs.**

## What this runsheet does

Executes two pre-written briefs in sequence with combined safety + verification:
1. **Phase 1 — Brief #13** (`@brief-13-pricing-update.md`) — pricing finalisation + remove in-person mentions across `v3/services.html`. Lower risk; touches one file.
2. **Phase 2 — Brief #14a** (`@brief-14a-constitution-card-component.md`) — constitution-card component in v2 + doctor/patient view refactor + clean portal URLs. Higher risk; touches multiple files.

**Why this order:** Brief #13 is smaller and faster to verify. If something goes sideways with #13, easier to isolate before stacking #14a's larger blast radius on top.

## PRE-FLIGHT — Before either brief runs

### P1 — Single combined snapshot (covers both rollbacks)

Create the snapshot directory ONCE; back up every file either brief touches:

```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/runsheet-13-and-14a-pre-migration
mkdir -p $SNAP

# Brief #13 target
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html $SNAP/services.html

# Brief #14a targets
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/doctor/patients.js $SNAP/patients.js
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/patient/ai-diagnosis.js $SNAP/ai-diagnosis.js
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/doctor.html $SNAP/v2-doctor.html
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/portal.html $SNAP/v2-portal.html

# Brief #14a v3 nav targets (clean URL link updates)
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/index.html $SNAP/v3-index.html
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/about.html $SNAP/v3-about.html
cp /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html $SNAP/v3-practitioners.html
# v3/services.html already copied above for Brief #13
```

Create `$SNAP/README.md`:
```markdown
# Runsheet snapshot — Brief #13 + #14a (2026-05-04)

Covers both briefs. To rollback EITHER brief:

## Rollback Brief #13 only
- cp services.html → /v3/services.html

## Rollback Brief #14a only
- cp patients.js → /v2/assets/js/panels/doctor/patients.js
- cp ai-diagnosis.js → /v2/assets/js/panels/patient/ai-diagnosis.js
- cp v2-doctor.html → /v2/doctor.html
- cp v2-portal.html → /v2/portal.html
- cp v3-index.html, v3-about.html, v3-services.html, v3-practitioners.html → respective /v3/ paths
- Delete v2/assets/js/components/constitution-card.js (and the components/ dir if empty)
- Delete root-level /portal.html, /doctor.html, /pharmacy.html, /admin.html

## Rollback BOTH
- All of the above. Or: git revert the commits from this runsheet.
```

### P2 — Pre-flight grep baseline

Capture current state for diff comparison after run:

```bash
grep -c "PRICE: TBD\|DATE: TBD" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -c "renderJsonAsRows" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/doctor/patients.js
grep -c "../v2/portal.html\|../v2/doctor.html" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
```

Write the numbers down — Phase 3 verification compares against these.

---

## PHASE 1 — Execute Brief #13

**Source:** `briefs/brief-13-pricing-update.md`

Read the brief in full and execute every task (A through G). Key acceptance criteria:
- All `[PRICE: TBD]` and `[DATE: TBD]` markers removed from `v3/services.html` (target: zero remaining)
- Comparison table shows: "Free during beta" / "From RM 35 / session" / "By prescription"
- TCM consultation lead text says "Video consultations" (not "Video or in-person")
- Pricing line shows RM 35 (random) / RM 55 (chosen) with "launch promo" framing
- "What's the difference between video and in-person?" FAQ replaced with "Will I see in-person consultations later?"
- Herb shop pricing says "Prices vary by prescription · speak to your practitioner"
- AI Wellness says "Free during beta"
- Meta description, OG, Twitter tags updated (drop "in-person", add "RM 35 launch promo")
- Other v3 pages (`v3/index.html`, `v3/about.html`, `v3/practitioners.html`) flagged if they contain in-person mentions — but NOT modified in this brief

### Phase 1 verification gate (DO THIS BEFORE PROCEEDING TO PHASE 2)

Run:
```bash
grep -n "PRICE: TBD" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -n "DATE: TBD" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -in "in-person" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -in "親診" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
```

**Pass criteria:**
- First two greps: zero results
- Last two greps: results only inside the "Coming soon" framing (Tasks D1 and D5 of Brief #13)

**If pass:** continue to Phase 2.
**If fail:** STOP. Report the discrepancy. Do not proceed to Phase 2 until Phase 1 is clean — stacking Phase 2 on a broken Phase 1 makes rollback hard.

---

## PHASE 2 — Execute Brief #14a

**Source:** `briefs/brief-14a-constitution-card-component.md`

Read the brief in full and execute every task (A through G). Key reminders:

- **i18n pattern is critical:** all user-facing text must use `<span lang="en">/<span lang="zh">` pattern (use the `bilingual()` helper). Do NOT stack both languages visually. CEO confirmed this preference 2026-05-04.
- Component lives at `v2/assets/js/components/constitution-card.js` (NOT v3 — CEO chose to keep app code in v2 for now, migration note in component header explains future v3 move).
- Snapshot files for Brief #14a are ALREADY covered by this runsheet's pre-flight P1 — no need to create a separate `briefs/snapshots/brief-14a-pre-migration/` directory unless the brief explicitly requires it (it does — keep it as well, both can coexist).
- Clean URL redirects (Task F): root-level `/portal.html`, `/doctor.html`, `/pharmacy.html`, `/admin.html` — same meta-refresh pattern as the root `index.html` from Brief #12.
- v3 nav links (Task F2): update all 4 v3 pages to use `../portal.html` etc. instead of `../v2/portal.html`. **Note:** Phase 1 already touched `v3/services.html` — make sure nav-link updates here don't conflict with Brief #13's edits. Test after.
- TASKS.md update (Task G): mark Brief #5 as superseded, mark Brief #13 + #14a as done.

### Phase 2 verification gate

Run:
```bash
# Constitution component exists
ls -la /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
wc -l /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js

# No more renderJsonAsRows in constitution context
grep -A2 "renderJsonAsRows" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/doctor/patients.js | grep -i "constitution\|qi_xu"

# i18n pattern present in component
grep -c "lang=\"en\"\|lang=\"zh\"" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js

# Clean URL files exist
ls /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/portal.html
ls /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/doctor.html
ls /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/pharmacy.html
ls /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/admin.html

# v3 nav links updated
grep -c "../v2/portal.html" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
grep -c "../portal.html" /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
```

**Pass criteria:**
- Component file exists, >300 lines (rough sanity check)
- No constitution-context `renderJsonAsRows` calls in patients.js
- Many `lang="en"`/`lang="zh"` matches in component (>40 reasonable)
- All 4 root-level redirect files exist
- v3/services.html has `../portal.html` references and zero `../v2/portal.html` portal-app references (note: legacy `../v2/blog.html`, `../v2/contact.html`, etc. for non-portal pages may still be acceptable — only the portal/doctor/pharmacy/admin URLs need to change)

**If pass:** continue to Phase 3.
**If fail:** STOP. Report which check failed. Use the snapshot at `$SNAP` to revert files individually if needed.

---

## PHASE 3 — Combined commit + push

Stage everything from both briefs and push as a SINGLE commit so the git history is atomic:

```bash
cd /sessions/lucid-gallant-goldberg/mnt/Hansmed-system

git add v3/services.html
git add v3/index.html v3/about.html v3/practitioners.html
git add v2/assets/js/panels/doctor/patients.js
git add v2/assets/js/panels/patient/ai-diagnosis.js
git add v2/assets/js/components/constitution-card.js
git add v2/doctor.html v2/portal.html
git add portal.html doctor.html pharmacy.html admin.html
git add briefs/snapshots/runsheet-13-and-14a-pre-migration/
git add briefs/snapshots/brief-14a-pre-migration/  # if Brief #14a created its own
git add TASKS.md

git commit -m "Brief #13 + #14a: pricing finalisation + constitution card component + clean portal URLs

- v3/services.html: RM 35 random / RM 55 chosen pricing, remove in-person mentions, AI Wellness 'Free during beta', herb pricing 'speak to practitioner'
- New v2/assets/js/components/constitution-card.js: shared component with bilingual lang-switcher pattern
- Doctor view (v2 patients.js) bug fixed: constitution data now renders with proper labels instead of raw JSON
- Patient view (v2 ai-diagnosis.js) refactored to consume from new component (no behavior change)
- Root-level /portal.html, /doctor.html, /pharmacy.html, /admin.html clean URL redirects
- v3 nav links updated to use clean URLs
- Snapshots saved for rollback insurance"

git push
```

GitHub Pages should rebuild in 30-60 seconds.

---

## PHASE 4 — Post-deploy verification (manual, ~10 min)

**Brief #13 checks:**
1. Open `https://hansmedtcm.github.io/Hansmed-system/v3/services.html` → comparison table shows "From RM 35 / session", AI Wellness shows "Free during beta", herb shop shows "By prescription"
2. Scroll to TCM Consultations section → pricing line shows RM 35 / RM 55 with launch promo framing
3. Check FAQ → "Will I see in-person consultations later?" present (no longer "What's the difference between video and in-person?")
4. Toggle EN/中 switcher → all changes appear in both languages

**Brief #14a checks:**
5. Sign in as a doctor → open any patient with a Constitution Questionnaire → click into the questionnaire detail modal
6. Confirm: NO `[object Object]`, NO raw JSON. Should see: Q1-Q10 with question text + readable answers; dimension bars; coloured pattern cards; herb/food chips; tongue constitution name + confidence
7. Toggle EN/中 in doctor view → modal flips language cleanly (no stacked bilingual)
8. Sign in as a patient → click through Wellness Assessment end-to-end → should behave identically to before (no regressions)
9. From any v3 page click "Sign In" / "My Portal" → URL shows `/Hansmed-system/portal.html` first, then redirects to v2 portal

**Cross-check:**
10. Open browser DevTools → Network tab → confirm `constitution-card.js` loads (200 OK) on both `/v2/doctor.html` and `/v2/portal.html`
11. Open Cloudflare Web Analytics dashboard → page views still flowing (not broken by the changes)

---

## REPORT BACK

```
============================================================
COMBINED RUNSHEET — Brief #13 + #14a
============================================================

PHASE 1 (Brief #13 — pricing) results:
  [PRICE: TBD] count after edit: ___ (target: 0)
  [DATE: TBD] count after edit: ___ (target: 0)
  In-person mentions remaining (services.html, allowed-only): [list]
  Other v3 pages with in-person flagged for CEO review: [list]
  Phase 1 verification gate: [PASSED / FAILED]

PHASE 2 (Brief #14a — constitution card + clean URLs) results:
  v2/assets/js/components/constitution-card.js created: [yes/no]  Lines: ___
  Doctor view bug fixed (no JSON dump in constitution context): [yes/no]
  Patient view refactor is no-op: [yes/no]
  i18n pattern (lang spans) used everywhere: [yes/no]
  Clean URL files created (4 expected): [yes/no]
  v3 nav links updated to clean URLs: [yes/no]
  TASKS.md updated: [yes/no]
  Phase 2 verification gate: [PASSED / FAILED]

PHASE 3 (commit + push):
  Commit hash: ___________
  Pushed: [yes/no]
  GitHub Pages rebuild: [confirmed within 60s / waited longer]

PHASE 4 (manual post-deploy checks):
  1. Comparison table pricing visible: [yes/no]
  2. RM 35/55 with launch promo framing: [yes/no]
  3. New "in-person coming soon" FAQ: [yes/no]
  4. EN/中 toggle works on services.html: [yes/no]
  5. Doctor view constitution modal renders properly: [yes/no]
  6. No [object Object] / no raw JSON anywhere: [yes/no]
  7. EN/中 toggle works in doctor modal: [yes/no]
  8. Patient assessment flow no regressions: [yes/no]
  9. /portal.html clean URL works: [yes/no]
  10. constitution-card.js loads (200 OK) on both v2 pages: [yes/no]
  11. Cloudflare Analytics still flowing: [yes/no]

Snapshot directory created and populated: [yes/no]
  Path: briefs/snapshots/runsheet-13-and-14a-pre-migration/

Anything you noticed that needs CEO attention: [list]
```

---

## ROLLBACK PROCEDURES

### Roll back BOTH briefs
```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/runsheet-13-and-14a-pre-migration
cp $SNAP/services.html       /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
cp $SNAP/v3-index.html       /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/index.html
cp $SNAP/v3-about.html       /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/about.html
cp $SNAP/v3-practitioners.html /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/practitioners.html
cp $SNAP/patients.js         /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/doctor/patients.js
cp $SNAP/ai-diagnosis.js     /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/patient/ai-diagnosis.js
cp $SNAP/v2-doctor.html      /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/doctor.html
cp $SNAP/v2-portal.html      /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/portal.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/portal.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/doctor.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/pharmacy.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/admin.html
git add -A
git commit -m "Rollback: revert Brief #13 + #14a runsheet"
git push
```

### Roll back ONLY Brief #14a (keep #13 pricing changes)
```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/runsheet-13-and-14a-pre-migration
cp $SNAP/patients.js         /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/doctor/patients.js
cp $SNAP/ai-diagnosis.js     /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/panels/patient/ai-diagnosis.js
cp $SNAP/v2-doctor.html      /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/doctor.html
cp $SNAP/v2-portal.html      /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/portal.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v2/assets/js/components/constitution-card.js
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/portal.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/doctor.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/pharmacy.html
rm /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/admin.html
# Keep v3/services.html with Brief #13's changes; revert v3 nav links manually if needed
git add -A
git commit -m "Rollback: revert Brief #14a only, keep #13 pricing changes"
git push
```

### Roll back ONLY Brief #13 (keep #14a constitution card)
```bash
SNAP=/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/briefs/snapshots/runsheet-13-and-14a-pre-migration
cp $SNAP/services.html /sessions/lucid-gallant-goldberg/mnt/Hansmed-system/v3/services.html
git add -A
git commit -m "Rollback: revert Brief #13 only, keep #14a constitution card"
git push
```

---

## NOTES

- Both briefs were CEO-approved 2026-05-04. Brief #13 confirmed to use RM 35 / RM 55 visible pricing with FOC tester access via voucher codes (voucher implementation pending Day 1-2 of 10-day sprint, separate brief).
- Brief #14a uses `<span lang="en">/<span lang="zh">` language-switcher pattern per CEO confirmation (do NOT stack both languages visually).
- Component lives in v2 for now; future v3 portal migration (Brief #15+) will move it cleanly with a 3-step rename.
- This runsheet is a wrapper. Full task definitions live in the source briefs — do not duplicate them here.
- Total expected duration: ~30-45 min from Phase 1 start to Phase 4 completion if no failures.
