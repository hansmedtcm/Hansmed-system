# Constitution v1 — archived 2026-05-12 (Brief #22)

These files comprised the original patient-facing "AI Wellness Assessment"
flow — a 10-question constitution questionnaire that produced a patient-facing
wellness report.

**Why archived:**
Brief #22 replaced this flow with a doctor-facing tongue-led adaptive
pre-assessment. The new flow is:
- Patient-facing: no diagnosis revealed
- Doctor-facing: comprehensive handoff packet (Western differentials,
  TCM pattern hypothesis, contraindications, suggested treatment)
- Goal: reduce consult time by 30-40% while preserving accuracy

**What\'s in here:**
- `ai-diagnosis.js` — the old patient JS panel
- `QuestionnaireController.php` (if present) — original questionnaire API
- `ConstitutionReviewController.php` (if present) — doctor review of the
  old constitution questionnaire

**Note on database:**
The `questionnaires` table is NOT dropped. Existing rows (Brief #5 + #18
references) remain for historical review. The new flow writes to the new
`pre_assessments` table.

**To revive any of this code:**
Copy back to the original path, register routes in `backend/routes/api.php`,
re-include script tag in `v2/portal.html`. The `HM.patientPanels.aiDiagnosis`
binding the old code uses is unchanged.

**Status:** these files are still PRESENT in their original locations as
of this archive (we copied, not moved). When the new flow is verified in
production, the original copies can be deleted in a follow-up commit.
