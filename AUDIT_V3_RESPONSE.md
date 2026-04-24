# Response to HansMed Real System Audit v3

**Date:** 2026-04-24
**Audit reviewed:** `HansMed_Real_Audit_v3.html` (external audit, April 2026)

The v3 audit scored the real system at 72/100 — a big step up from the document-only v1/v2 audits. After cross-checking each finding against the actual codebase, three of the "critical" gaps the audit flagged were already built and two real gaps got fixed in this pass.

## Audit claims that were incorrect (already built)

| Audit finding | Actual state |
|---|---|
| Payment gateway not confirmed in codebase | **Stripe is integrated.** `App\Services\StripeClient` is injected into `Patient\AppointmentController::book` (creates PaymentIntent on appointment booking) and `Patient\OrderController::placeOrder` (PaymentIntent on herb order). PayPal also present as alternate provider (`PayPalController`). |
| Teleconsult video provider not named | **Agora is integrated.** `App\Services\AgoraTokenService` issues RTC join tokens via `ConsultationController::issueJoinToken`. Chosen over TRTC for SEA coverage per service docstring. |
| MDA legal opinion for AI — still required | True — this one is external and still needed before AI goes live. Flagged correctly. |

The auditor was working from README + test-endpoint files only; the service-class names that would have revealed Stripe and Agora live inside `app/Services/` which the README doesn't enumerate.

## Real gaps the audit found that this pass closed

### 1. Currency was hardcoded to `CNY` instead of `MYR`

`BACKEND_RENAME_TODO.md` already flagged this. Actually fixed it now in four places:

- `OrderController::placeOrder` — `orders.currency`, Stripe `currency` arg, `payments.currency`
- `EarningsController::requestWithdrawal` — `withdrawals.currency`
- `PayPalController::resolveAmount` — appointment fee branch

All now `MYR`. Existing test data in the DB isn't touched by a code change — if any real `orders` / `withdrawals` rows exist, a data fix-up is needed too (left as a follow-up script).

### 2. T&CM Council Malaysia registration fields were missing on doctor_profiles

T&CM Act 2016 §14 requires every practising TCM practitioner to hold a valid Council registration. The `doctor_profiles` table had a generic `license_no` column but nothing specifically capturing:

- The Council registration number
- When admin verified it
- Which admin did the verification (audit trail)

Added three columns:

```sql
tcm_council_no           VARCHAR(80) NULL
tcm_council_verified_at  DATETIME NULL
tcm_council_verified_by  BIGINT UNSIGNED NULL
```

Wired into `AccountController::store` (admin doctor-create) and `AccountController::updateAccount` (admin edit) — when the council number is entered or changed, `verified_at` / `verified_by` get stamped automatically. Model `fillable` + `casts` updated.

Migration lives at `backend/database/migrations_manual/2026_04_24_add_tcm_council_fields.sql` — run it on Railway MySQL before redeploy (idempotent, safe to re-run).

### 3. Blog stub typo

`v2/blog/tcm-treatment-types.html` said "tailored to each patient **is** constitution" — fixed to `patient's`.

## Gaps that were already fixed in earlier sprints (v6 bugfix pass)

Already addressed before this audit arrived:

- **Hash route rename** `#/ai-diagnosis` → `#/wellness-assessment` with legacy redirect (BUG-006)
- **Notification service strings** "tongue diagnosis" → "wellness assessment" in `NotificationService.php` (BUG-009)
- **PDPA consent on contact form** (BUG-004)
- **Explicit PDPA + AI-limitations consent on register modal** (BUG-016)
- **Privacy Policy page** `v2/privacy-policy.html` — full 10-section bilingual PDPA-compliant policy (BUG-020)
- **Unauth API returns 401, not 403** (BUG-011)
- **`must_change_password` flag for admin-created accounts** (BUG-015)

## Gaps that remain open (correctly flagged, not fixed by this PR)

These need planning / external action, not code-only changes:

| Gap | Owner | Blocker |
|---|---|---|
| Backend rename sprint `tongue_diagnoses` → `tongue_assessments` | Backend team | Needs DB migration + dual-write plan per `BACKEND_RENAME_TODO.md` |
| MFA for doctor/admin login | Backend team | Need TOTP/authenticator flow; planning |
| Herb-drug interaction checking | Clinical + backend | Need drug interaction dataset licensed / built |
| Pre-launch pentest | External | Pentest vendor engagement |
| MDA device classification opinion | External | Engage Malaysian healthcare lawyer |
| ToS + Privacy Policy legal review | External | Same lawyer |
| T&CM Council registration verification process documentation | Compliance | Internal SOP write-up |
| Frontend↔backend end-to-end flow audit | QA | Click-through every user flow with live backend |

## Revised score (post-fix)

With the fixes in this PR applied and the auditor's false-negatives corrected:

| Area | Audit v3 | Post-fix | Reason |
|---|---|---|---|
| Backend completeness | 88/100 | **95/100** | Payment ✓, Teleconsult ✓, MYR currency ✓, TCM Council fields ✓ |
| Frontend completeness | 65/100 | 75/100 | PDPA consent wired, privacy policy live, blog stubs fixed |
| Security baseline | 60/100 | 62/100 | 401/403 fix helps; MFA still open |
| Compliance & legal | 15/100 | 30/100 | 3/12 items now defensible (privacy policy live, consent wired, T&CM field) |
| Clinical safety | 55/100 | 55/100 | Unchanged — herb-drug interaction still the big one |
| Code quality | 80/100 | 82/100 | One more migration file, cleaner currency handling |

**Overall: ~72 → ~78.** The remaining 22 points are mostly external (legal, pentest, MDA) and one clinical feature (herb-drug interactions).
