# Backend Rename TODO — "AI Diagnosis" → "TCM Wellness Assessment"

**Created:** 2026-04-21
**Scope of this sprint:** Frontend strings only (completed).
**Scope of this file:** Everything that was deliberately left alone for a future sprint. Do not tackle without a dedicated migration plan — several of these are DB columns / class names / route slugs that break API consumers if renamed carelessly.

## Why this is deferred

Renaming backend identifiers is a much larger change than renaming UI strings:
- DB column renames need a migration + a dual-write / backfill plan
- Class and file renames ripple through the autoloader and every `use` statement
- Route slug changes break the frontend until both sides deploy
- External API consumers (your agents, future mobile app) might pin to these names

So we grouped everything into this file and will plan a dedicated sprint.

## Inventory

### 1. Database — table and column names

| File / location | Identifier | Current | Target |
|---|---|---|---|
| `backend/database/schema.sql:111` | Table name | `tongue_diagnoses` | `tongue_assessments` |
| `backend/database/schema.sql:158` | FK column in `appointments` | `tongue_diagnosis_id` | `tongue_assessment_id` |
| `backend/database/schema.sql:200` | Column in `prescriptions` | `diagnosis` (practitioner-issued) | **KEEP** — practitioner diagnosis is legally valid |

**Migration approach:** dual-write pattern. Add new columns, backfill from old, run both for one release, then drop old. Plan with a DBA.

### 2. Laravel models & controllers

| File | Identifier | Current | Target |
|---|---|---|---|
| `backend/app/Models/TongueDiagnosis.php` | Class + file | `TongueDiagnosis` | `TongueAssessment` |
| `backend/app/Http/Controllers/Patient/TongueDiagnosisController.php` | Class + file | `TongueDiagnosisController` | `TongueAssessmentController` |
| `backend/app/Http/Controllers/Admin/TongueDiagnosisConfigController.php` | Class + file | `TongueDiagnosisConfigController` | `TongueAssessmentConfigController` |
| `backend/app/Services/TongueDiagnosisClient.php` | Class + file | `TongueDiagnosisClient` | `TongueAssessmentClient` |
| `backend/app/Services/AnthropicTongueClient.php` | Internal comments | "tongue diagnosis" | "tongue assessment" |
| `backend/app/Services/TongueDiagnosis/*.php` | Namespace folder | `App\Services\TongueDiagnosis` | `App\Services\TongueAssessment` |
| `backend/app/Jobs/AnalyzeTongueDiagnosis.php` | Class + file | `AnalyzeTongueDiagnosis` | `AnalyzeTongueAssessment` |

**Approach:** one big PR with IDE refactor, run full test suite, manual smoke test, deploy.

### 3. API routes

| File | Line | Route | Current | Target |
|---|---|---|---|---|
| `backend/routes/api.php` | 162 | `GET /tongue-knowledge` | (path OK) | (no change) |
| `backend/routes/api.php` | 195–198 | Patient tongue endpoints | `/tongue-diagnoses` | `/tongue-assessments` |
| `backend/routes/api.php` | 233 | Doctor endpoint | `/patients/{id}/tongue-diagnoses` | `/patients/{id}/tongue-assessments` |
| `backend/routes/api.php` | 247 | Doctor review | (tongue review) | (rename per label) |
| `backend/routes/api.php` | 387–388 | Admin config | `/tongue-config` | (path OK; internal label) |

**Approach:** keep old routes alive with a `@deprecated` flag for one release cycle, then remove. Update frontend to use new paths. Add a 301-style response header pointing to the new path.

### 4. Frontend hash routes and filenames (NOT done this sprint)

| Location | Current | Target |
|---|---|---|
| URL hash | `#/ai-diagnosis` | `#/wellness-assessment` |
| JS file | `v2/assets/js/panels/patient/ai-diagnosis.js` | `v2/assets/js/panels/patient/wellness-assessment.js` |

**Approach:** add a redirect layer in the hash router (e.g. `onhashchange`: if `#/ai-diagnosis`, rewrite to `#/wellness-assessment`). Keeps any bookmarked links working.

### 5. Notification service strings

| File | Lines | Current |
|---|---|---|
| `backend/app/Services/NotificationService.php` | 133, 138, 155, 188, 193 | User-visible toast/email copy like "Tongue diagnosis approved · 舌診審核通過" |

**Approach:** user-visible strings. Rename to "Tongue assessment" / "舌診評估". Low risk, do this in the same PR as the class renames.

### 6. `diagnosis` column on `prescriptions` table — DO NOT RENAME

Line `backend/database/schema.sql:200` — `diagnosis TEXT NULL` on the `prescriptions` table.

This column holds a **practitioner-issued diagnosis**, which is legally valid when the practitioner is T&CM Council registered. The compliance copy guidance explicitly allows the word "diagnosis" in this context (see `docs/ux/compliance-copy-changes.md` "Do NOT replace" section). Leave this column name alone.

## Suggested sprint sequence

1. **Week 1:** DB migration plan, write dual-write code
2. **Week 2:** Laravel class + file renames in a single PR; run full test suite
3. **Week 3:** API route dual-routing + frontend updates
4. **Week 4:** Backfill + cleanup; drop old column names
5. **Week 5:** Final audit + documentation update

Total estimate: 3–5 engineer-days of real work, spread over 5 calendar weeks to allow dual-write overlap.

## Non-backend follow-ups also parked here

These came up during the 2026-04-21 code pass but didn't fit the sprint scope:

- **Order currency is hardcoded to `CNY`** at `backend/app/Http/Controllers/Patient/OrderController.php:187` (`'currency' => 'CNY'`). Should be `MYR` for a Malaysian business. Requires data migration if any real orders exist. Flag for review before real payments go live.
- **i18n supports only EN + ZH, not BM.** The compliance copy and several docs call for Bahasa Malaysia, but the code pattern is bilingual EN · ZH inline. Add BM as a proper post-pilot feature if the target audience needs it.
- **Frontend asset pipeline is raw `<script src>` tags.** No bundler. Fine for pilot, revisit before scale.
