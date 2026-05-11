# Brief #1 — Edit-in-consult bug (case record + treatments lost)

**Hand this to Claude Code in a fresh session at `E:\Hansmed-system`. Copy from `## TASK` to the end of the file.**

---

## TASK

Fix the bug where re-entering a completed consult via the prescription tab's "Edit in consult · 回診編輯" button rehydrates only the prescription. Chief complaint, BP, pulse, body diagrams, treatment list, and every other case-record field stay blank.

## REPRODUCE FIRST

1. As a doctor, complete a consult with full case record fields filled in (chief complaint, present illness, BP, pulse, pattern diagnosis, body diagram drawings) and add at least one treatment + one prescription item.
2. Click "Issue & Complete · 完成並開方" so the consultation row + prescription get persisted.
3. Go to the doctor's **Prescriptions** tab.
4. Click "Edit in consult · 回診編輯" on the issued Rx.
5. Observe: the prescription pad rehydrates correctly, but every case-record field and the treatments list are empty.

## INVESTIGATE IN THIS ORDER — STOP AT THE FIRST CAUSE FOUND

### Step 1 — Confirm the DB actually has the data

Run a query against the dev MySQL:

```sql
SELECT id, appointment_id,
       case_record IS NOT NULL AND case_record != 'null' AS has_cr,
       treatments  IS NOT NULL AND treatments  != 'null' AS has_tx,
       LENGTH(case_record) AS cr_len,
       LENGTH(treatments)  AS tx_len,
       ended_at
FROM consultations
WHERE appointment_id = <the appt id you tested with>;
```

If `has_cr` or `has_tx` is 0/false, **the save side is broken.** Check whether `completeConsult(true)` in `v2/assets/js/panels/doctor/consult.js:1569-1625` actually awaits `consultation.finish` before `issuePrescription`, and whether the `/finish` endpoint silently dropped `case_record` (e.g. validation 422 swallowed by the toast). **Stop and report this to the CEO before patching — the fix design needs sign-off.**

### Step 2 — If DB has the data, check the API response

Open browser devtools → Network tab → click "Edit in consult" on a prescription → inspect the `GET /api/doctor/appointments/{id}` response.

Confirm `consultation.case_record` is a populated object and `consultation.treatments` is a populated array.

If null or missing, fix `backend/app/Http/Controllers/Doctor/AppointmentController.php` around lines 166-188 — that's where the response is assembled.

### Step 3 — If response is good, the bug is form rehydration

In `v2/assets/js/panels/doctor/consult.js`:

- `render()` (line 36) loads state from the API. Lines 69-82 set `state.caseRecord` and `state.treatments` from `apptRes.consultation`. Add a `console.log('[rehydrate]', state.caseRecord, state.treatments)` after line 82 to verify the state is actually populated.
- `render()` then branches into `renderWalkIn` or `renderOnline` (lines 119-123).
- The form-fill helper sets DOM inputs via `set('cr-...')` calls — see around line 198-210 and line 354.
- The treatments list is re-rendered by the helper around line 1180-1230, reading `state.treatments`.
- Body diagrams reload from `state.caseRecord[savedKey]` in `initBodyDiagram()` at line 825.

The most likely cause: the form-fill helper isn't being called after the form HTML is injected, OR it's called too early (before the DOM nodes exist), OR only one of the two render paths (online vs walk-in) calls it.

The fix: ensure the rehydration helper runs **after** `caseRecordMarkup()` and `treatmentsMarkup()` are inserted into the DOM, on **both** the online and walk-in render paths.

### Step 4 — Body diagrams come back too

When the user re-enters consult, the body diagrams they drew before should display with their drawings intact, not blank. Verify `initBodyDiagram()` (around line 798) fires after rehydration, not before.

## ACCEPTANCE CRITERIA

- Click "Edit in consult" on an issued Rx → consult page loads with **all** of: chief complaint, present illness, past history, pulse, BP, pattern diagnosis, western diagnosis, treatment principle, doctor instructions, **all body diagrams with prior drawings visible**, **all treatments listed with correct fees**, and the prescription pad pre-filled (which already works).
- Editing and re-submitting still supersedes the prior Rx — don't break the existing flow.
- No regressions on the normal "complete a fresh consult" flow.

## REPORT BACK TO THE CEO (in this format)

```
Root cause: Step [1/2/3/4] — [one-sentence description]
Files changed: [list with line numbers]
Diff summary: [3-5 bullets describing the change]
Tested by: [what you did to confirm — manual repro, console log output, DB check]
Regressions checked: [what you re-tested]
```

If anything is unclear or the codebase has changed since this brief was written, ask the user before patching.
