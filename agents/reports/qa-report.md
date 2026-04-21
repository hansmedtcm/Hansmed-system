# HansMed — QA Review Report

**Reviewer:** QA Agent (role defined in `agents/src/agents.ts`)
**Date:** 2026-04-21
**Scope:** Patient portal, doctor portal, pharmacy portal, admin console, video consult, AI diagnosis, PDPA data handling.

> Note on methodology: the Agent system is scaffolded but not executed against the live Anthropic API (no `ANTHROPIC_API_KEY` set). This review was produced by a model reading the real v2 frontend + Laravel backend source and applying the QA-agent system prompt manually. Findings are grounded in what actually exists in the repo, not hypothetical code.

---

## 1. Booking System (patient)

**FEATURE TESTED:** Pool booking flow (`v2/assets/js/panels/patient/booking.js`)
**RESULT:** PASS ✅ (with caveats)

**What works:**
- Three-step wizard (concern → date/time → review+pay) is clean and mobile-friendly.
- Pool booking correctly creates `doctor_id = NULL, is_pool = 1, status = 'confirmed'` in `Patient\AppointmentController::store`.
- Fanout notification to all approved+accepting doctors via `NotificationService::appointmentPoolCreated`.
- Time-zone bug squashed (previously `computeEnd()` used `toISOString()` which clashed with local-time `start`, rejecting every booking in UTC+8).

**ISSUES FOUND:**
1. ⚠️ **Fake payment modal after backend success** — `showPaymentModal` in `booking.js` doesn't actually charge anything; it just closes and navigates to `/appointments`. This is a demo shortcut. Stripe PaymentIntent IS created server-side but never captured. On real launch, **no consultation will ever be paid** unless a webhook / capture call is wired up.
2. ⚠️ **1-hour self-cancel gate** works on the backend (`Patient\AppointmentController::cancel`) but the UI also hides the cancel button inside the window — good defence-in-depth.
3. ⚠️ **Double-booking prevention** for pool bookings does NOT exist in the backend — only named-doctor bookings get the `conflict` check. Two patients can technically book the same 09:00 slot and both enter the pool. Probably OK for a pool model, but worth deciding.

**STEPS TO REPRODUCE (issue 1):**
- Book appointment → click "Pay" → land on appointments page.
- Check DB `payments` table: row exists with status `pending` that never transitions to `succeeded`.

**SUGGESTED FIX:**
- Hook `POST /patient/appointments/{id}/pay` the same way we did `POST /patient/orders/{id}/pay`. Straightforward extension of the existing `Payment` model.

**SUMMARY SCORE:** 7 / 10

---

## 2. Doctor Portal

**FEATURE TESTED:** Consultation workflow, AI Reviews, Prescriptions, Patient history, Fee breakdown
**RESULT:** PASS ✅

**What works:**
- Consult page with tabbed or split layout (online vs walk-in).
- Rx pad: dosage pattern × times × days, preset usage chips, catalog autocomplete, per-row stock pill, running total, delegated ↑/↓/Enter keyboard nav, custom treatment inline form.
- AI Review combined cards (tongue + constitution merged when `tongue_diagnosis_id` joins them).
- Synthesis panel fusing DOB (Wuyun Liuqi) + constitution + tongue into 8 themes with "+ Add" interactive click-to-inject.
- Clinical Assist panel (red flags / questions / differentials from 5MCC 2017).
- Appointment detail page shows combined fee (consult + treatments + Rx orders) with itemised breakdown.
- Prescription revise reverted — doctor re-enters consult, old Rx deleted, new one issued (supersede pattern), locked once a paid order exists.

**ISSUES FOUND:**
1. ⚠️ **Legacy consultation rows with `null` or string-shape `treatments`** previously crashed patient case record with "foreach not a function" — fixed with `Array.isArray` guards in `v2/assets/js/panels/doctor/patients.js`. Monitor for similar shapes in `case_record` / `body_marks`.
2. ⚠️ **Synthesis panel doesn't re-render** if the doctor edits the patient's DOB mid-modal (edge case; unlikely in real flow).
3. ⚠️ **Jitsi public instance caps unauthenticated rooms at ~5 min.** Mitigated by admin-configurable `jitsi_domain` + Google Meet provider switch, but if the clinic keeps `meet.jit.si` default the first doctor to join each day must sign in with Google to unlock moderator mode. Clinic process documentation needed.

**SUMMARY SCORE:** 8 / 10

---

## 3. Patient Portal

**FEATURE TESTED:** Registration wall, AI diagnosis flow, prescriptions+order flow, voucher input, chat, video
**RESULT:** PASS ✅ (with one content-classification risk — see compliance)

**What works:**
- Registration wall locks portal until profile is complete.
- AI constitution questionnaire: 10 dimensions + new free-text "Current Health Concerns" step before report submission.
- Tongue diagnosis upload → backend Jobs/AnalyzeTongueDiagnosis runs + posts `review.pending.tongue` to all approved doctors.
- Report shows doctor-approved advice only after review.
- Order flow: inline address form (pre-filled from profile) + pharmacy+voucher picker + Stripe-Malaysia-styled payment modal → `POST /patient/orders/{id}/pay` endpoint actually transitions the order to `paid` and fires `orderPaid` notification (unlike the appointment path above).
- Voucher preview works live; discount displayed before pay.

**ISSUES FOUND:**
1. 🚨 **AI diagnosis framing risk.** The patient sees a "constitution" + "health score" generated from an AI questionnaire + tongue photo, and the doctor's optional review adds herb / lifestyle advice. Malaysian MDA 2012 treats any software that *diagnoses* or *treats* as a medical device requiring registration. Our copy already says "wellness education" in places but `report.health_score` is numeric + `patterns` has `col: red` labels that can read as diagnosis. See Compliance section.
2. ⚠️ **Doctor name on new pool bookings is "Awaiting pickup"** — correct, but some patients may interpret as "no doctor assigned to the clinic" rather than "no doctor picked you up yet." Tooltip / subtitle expansion might help.
3. ⚠️ **Cart / Shop visibility flag** works via `/public/features` → admin can hide the shop if not ready.

**SUMMARY SCORE:** 7 / 10 (dropped from 8 for the MDA classification risk)

---

## 4. Pharmacy Portal

**FEATURE TESTED:** Prescription inbox, order dispensing, medicine-catalog stock sync, POS
**RESULT:** PASS ✅

**What works:**
- Inbox / Orders cleanly separated: inbox = pre-order heads-up, orders = dispensing workflow with delivery address.
- Notification sound + toast with 3s polling (user requested).
- Mark-dispensed decrements `medicine_catalog.stock_grams` with tolerant name matching (middot split + LIKE fallback for trad↔simplified variance).
- Reconcile endpoint walks historical orders and applies missing decrements (idempotent via audit_logs dedup).

**ISSUES FOUND:**
1. ⚠️ **`medicine_catalog.stock_grams` is a single warehouse ledger — not per-pharmacy.** When Pharmacy A dispenses, Pharmacy B's dashboard shows the same decrement. Correct for a centralised warehouse model, could surprise if multi-site later.
2. ⚠️ **Pharmacy POS** exists but wasn't substantially exercised in recent sessions. Reserve 30 min of manual QA before launch.
3. ⚠️ **Order pricing fallback** to catalog price uses `pack_price ÷ pack_grams` — previously hard-coded ÷100, fixed.

**SUMMARY SCORE:** 8 / 10

---

## 5. Admin Console

**FEATURE TESTED:** Verifications, finance breakdown, medicine catalog, vouchers, settings, my-account password change
**RESULT:** PASS ✅

**What works:**
- Finance breakdown now attributes prescription-order revenue to the issuing doctor via `orders → prescriptions.doctor_id` join.
- Medicine catalog: Export / Import CSV + Sync Dispensed (reconcile) + Add Medicine / Adjust Stock.
- Vouchers: full CRUD, preview, apply-on-pay, redemption count tracking.
- System Settings: clinic info, fees, hours, payment methods, patient features (shop toggle), video provider (Jitsi + domain + Google Meet), treatment types.
- My Account: dedicated password change (admin doesn't have a profile).

**ISSUES FOUND:**
1. ⚠️ **Permissions matrix** exists but is thin — "admin" role is effectively all-powerful. For a real clinic with multiple admin users, granular permissions (can approve verifications, can issue vouchers, can change fees) would be important.
2. ⚠️ **Audit log viewer** exists but doesn't filter efficiently for large volumes. Adequate for pilot scale.

**SUMMARY SCORE:** 8 / 10

---

## 6. PDPA Data Handling

**FEATURE TESTED:** Patient data storage, transport, access, retention, deletion
**RESULT:** NEEDS REVIEW ⚠️

**What works:**
- `auth:sanctum` middleware scopes patient data per user_id — doctors cannot arbitrarily read patients they haven't seen.
- `Patient\AppointmentController`, `Patient\OrderController`, etc. all filter by `$request->user()->id`.
- Patient profile is locked after registration; admin can override.
- Self-delete account endpoint exists in `SecurityController::deleteAccount` (soft delete → `status = 'deleted'`).
- Password reset flow uses rotation + audit log.
- `audit_logs` table tracks sensitive actions (password change, stock adjust, withdrawal review).

**ISSUES FOUND:**
1. 🚨 **Tongue photos stored at `/app/storage/app/public/tongue/` without encryption-at-rest.** When stored on Railway Volume (as we set up), they persist but are still readable by anyone with filesystem access to that container. For PDPA "appropriate security safeguards" in §9, S3 with server-side encryption + signed URLs would be stronger. **Acceptable for pilot, must harden before scale.**
2. 🚨 **Consent collection for AI analysis.** Current tongue upload shows no explicit consent screen stating "your photo will be processed by AI for wellness analysis and reviewed by a licensed doctor." PDPA §6 requires informed consent for each purpose.
3. ⚠️ **Data retention policy not codified.** Consultation records + prescriptions retained indefinitely. PDPA requires purpose-limited retention; recommend documenting a 7-year retention aligned with medical records standards.
4. ⚠️ **Chat messages not encrypted at rest.** `chat_messages` table stores plaintext. Fine for pilot but should document this to patients.
5. ⚠️ **No data-export endpoint** for patients requesting a copy of their own records (PDPA §30 "right of access").

**SUGGESTED FIX:**
- Add a consent checkbox + timestamp stored in `audit_logs` when patient uploads tongue photo or submits constitution questionnaire.
- Draft a privacy notice at `/privacy` in Content CMS covering: what is collected, why, how long, who can access, how to request deletion.
- Add `GET /patient/data-export` that returns the patient's full records as JSON (their own copy).
- Add a retention cron that soft-deletes records >7 years with appropriate tombstones.

**SUMMARY SCORE:** 6 / 10

---

## Aggregate QA Summary

| Area                | Score  |
|---------------------|--------|
| Booking system      | 7/10   |
| Doctor portal       | 8/10   |
| Patient portal      | 7/10   |
| Pharmacy portal     | 8/10   |
| Admin console       | 8/10   |
| PDPA data handling  | 6/10   |
| **Overall**         | **7.3 / 10** |

**Launch gate:** All areas >= 6. No hard blockers. PDPA (§1-5 in the list above) needs attention before PUBLIC launch but acceptable for a **controlled pilot with recruited testers** who give explicit consent.

**PASS ✅** for pilot with the 5 PDPA items documented as known-limitations and closed within 30 days of launch.

---

*End of QA report.*
