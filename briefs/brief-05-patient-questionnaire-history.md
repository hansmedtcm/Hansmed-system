# Brief #5 — Constitution Questionnaire history on doctor's patients page

## Background

The "Patients page hide-toggles + tongue history" task on `TASKS.md` was mostly already shipped:
- DOB analysis section: collapsible (`patients.js:280`, `collapsibleSection({key:'dob'...})`) ✅
- Tongue analysis section: collapsible + View All modal (`patients.js:315`, `openTongueHistoryModal`) ✅

One gap remains: the **AI Constitution Questionnaire** is a separate clinical artifact from the tongue assessment. Patients submit a 10-dimension constitution + health-concerns questionnaire (kind = `ai_constitution_v2`) via `POST /patient/questionnaires`. Doctors review them in the Constitution Review queue (`Doctor/ConstitutionReviewController`).

But when a doctor opens a specific patient's profile, there is currently no way to see that patient's **questionnaire history** alongside their tongue history. Doctor must dig through the review queue or query the DB. This brief closes that.

## TASK A — Backend: extend patient detail response with questionnaire history

In `backend/app/Http/Controllers/Doctor/PatientListController.php`, find the controller action that returns a single patient's detail (the one that currently includes tongue assessments — likely `show($id)` or similar). Add a `questionnaires` field to the response.

Logic:

```php
$questionnaires = \DB::table('questionnaires')
    ->where('patient_id', $patient->id)
    ->where('kind', 'ai_constitution_v2')
    ->orderByDesc('submitted_at')   // or created_at — whichever exists
    ->limit(20)
    ->get([
        'id',
        'submitted_at',         // or created_at
        'status',               // pending / approved / rejected
        'reviewed_at',
        'reviewed_by',
        'symptoms',             // JSON: the answers
        'ai_summary',           // JSON: the AI's analysis (if produced + stored)
        'doctor_notes',         // any notes the reviewing doctor left
    ]);

// Decode JSON columns server-side so the frontend gets real objects.
$questionnaires = $questionnaires->map(function ($q) {
    if (is_string($q->symptoms))   $q->symptoms   = json_decode($q->symptoms, true);
    if (is_string($q->ai_summary)) $q->ai_summary = json_decode($q->ai_summary, true);
    return $q;
});
```

Inspect the actual `questionnaires` table schema first (run `php artisan tinker` or check the migration) — column names might differ. If they do, adapt accordingly. Don't guess column names from this brief — verify.

Add `questionnaires` to the returned JSON response object next to the existing `tongues` field.

**Defensive (per the new auto-fix rule):**
- Wrap the DB query in try/catch; if the questionnaires table has a different shape than expected, log a warning and return `questionnaires: []` rather than crashing the patient page.
- If `submitted_at` doesn't exist, fall back to `created_at`.

## TASK B — Frontend: add a third collapsible section in patients.js

In `v2/assets/js/panels/doctor/patients.js`, after the tongue section (currently lines 288-323), add a parallel block for questionnaires using the same `collapsibleSection` helper:

```js
// Constitution questionnaires — collapsible, parallel to tongue section.
// Shows a card per submission with date, status badge, and a quick
// summary line. 'View All' opens the full history modal.
var questionnaires = c.questionnaires || [];
if (questionnaires.length) {
  var qCards = '<div class="grid-auto" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--s-3);">';
  questionnaires.slice(0, 3).forEach(function (q) {
    var statusBadge = renderQuestionnaireStatus(q.status);
    var summaryLine = (q.ai_summary && q.ai_summary.headline) ||
                      (q.symptoms && q.symptoms.chief_concern) ||
                      'Constitution submission';
    qCards += '<div class="card" style="cursor:pointer;" ' +
      'onclick="HM.doctorPanels.patients._viewQuestionnaire(' + patient.id + ',' + q.id + ')" ' +
      'title="Click for full report">' +
      '<div class="text-label">' + HM.format.date(q.submitted_at || q.created_at) + '</div>' +
      statusBadge +
      '<div class="text-sm mt-1">' + HM.format.esc(summaryLine) + '</div>' +
      '</div>';
  });
  qCards += '</div>';

  var qViewAllBtn = '<button class="btn btn--ghost btn--sm" ' +
    'onclick="HM.doctorPanels.patients._viewAllQuestionnaires(' + patient.id + ')" ' +
    'style="font-size:11px;padding:4px 10px;">' +
    '📋 <span lang="en">View All</span><span lang="zh">查看全部</span>' +
    '</button>';

  html += collapsibleSection({
    key:     'questionnaire',
    icon:    '📋',
    titleEn: 'Constitution Questionnaire · ' + questionnaires.length + ' submission' + (questionnaires.length === 1 ? '' : 's'),
    titleZh: '体质问卷（' + questionnaires.length + ' 份）',
    extras:  qViewAllBtn,
    body:    qCards,
  });
}
```

**Two helper functions to add (anywhere appropriate in the file):**

1. `renderQuestionnaireStatus(status)` — returns a small colored badge for `pending` / `approved` / `rejected`. Use existing badge style if one exists, otherwise inline:

   ```js
   function renderQuestionnaireStatus(s) {
     var style = {
       pending:  'background:#FFF7E6;color:#B5881A;',
       approved: 'background:#E6F4EA;color:#1E7E34;',
       rejected: 'background:#FCE8E6;color:#B71C1C;',
     }[s] || 'background:var(--washi);color:var(--mu);';
     var label = { pending: 'Pending review', approved: 'Reviewed', rejected: 'Rejected' }[s] || s;
     return '<div style="display:inline-block;font-size:10px;padding:2px 8px;border-radius:10px;margin-top:6px;' + style + '">' + label + '</div>';
   }
   ```

2. Add to the public action object near `_viewTongue` / `_viewAllTongues`:

   ```js
   _viewQuestionnaire: function (patientId, qId) {
     var c = _ctx.byPatient[patientId];
     if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
     var q = (c.questionnaires || []).find(function (x) { return x.id === qId; });
     if (!q) { HM.ui.toast('Could not find that questionnaire', 'warn'); return; }
     openQuestionnaireDetailModal(c.patient, q);
   },
   _viewAllQuestionnaires: function (patientId) {
     var c = _ctx.byPatient[patientId];
     if (!c) { HM.ui.toast('Patient context lost — please reopen this page', 'warn'); return; }
     openQuestionnaireHistoryModal(c.patient, c.questionnaires || []);
   },
   ```

3. New modals: `openQuestionnaireDetailModal(patient, q)` and `openQuestionnaireHistoryModal(patient, questionnaires)`. Mirror the structure of the existing `openTongueDetailModal` / `openTongueHistoryModal` for visual consistency. Detail modal should display:
   - Submission date + reviewer name (if reviewed)
   - Status badge
   - The 10-dimension constitution answers (loop over `q.symptoms` keys, render as labelled rows)
   - The chief concern / current health concerns the patient submitted
   - The AI summary if present (`q.ai_summary`)
   - Doctor's review notes if present (`q.doctor_notes`)

   History modal: scrollable list, each entry clickable to open the detail modal.

## ACCEPTANCE CRITERIA

- Open a patient who has submitted at least one constitution questionnaire (use any test patient or seed one if needed). The patient profile page now shows three collapsible sections: 🌿 DOB, 👅 Tongue Wellness, 📋 Constitution Questionnaire.
- The questionnaire section header is collapsible (preference persists in localStorage like the others).
- The "View All" button opens a modal listing every questionnaire submission for that patient.
- Clicking an individual questionnaire card opens a detail modal showing the answers, AI summary, status, and doctor notes.
- A patient with zero questionnaires sees no broken section (the block conditional `if (questionnaires.length)` is the same pattern as the tongue check).
- A patient who only has questionnaires but no tongues still sees the questionnaire section render correctly (the two are independent).
- No regressions on the DOB section, the tongue section, or the case history modal.
- Backend response gracefully degrades to `questionnaires: []` if the table query fails for any reason.

## REPORT BACK

```
Files changed: [paths + line numbers]
Pushed to: [commit hash]
Backend questionnaires field added to patient detail response: [yes/no]
Actual questionnaires table column names (please list): [...]
New collapsible section visible on a patient with submissions: [yes/no]
Detail modal shows answers + AI summary + status + notes: [yes/no]
Empty case (no questionnaires) renders cleanly: [yes/no]
Regressions checked: [DOB section, tongue section, case-record modal]
```

If the `questionnaires` table schema differs significantly from what this brief assumes (different column names, missing `ai_summary` field, etc.), STOP and report back what you found before patching frontend — don't guess at the response shape.
