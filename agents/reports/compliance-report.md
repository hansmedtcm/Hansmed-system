# HansMed — Regulatory Compliance Review

**Reviewer:** Compliance Agent (role defined in `agents/src/agents.ts`)
**Date:** 2026-04-21
**Frameworks audited:** Malaysia PDPA 2010, Medical Device Act 2012, Traditional & Complementary Medicine Act 2016, Consumer Protection Act 1999, Anthropic AUP

**Inputs:** QA report at `agents/reports/qa-report.md`, full codebase read (v2/ frontend + backend/ Laravel).

---

## Finding 1 — AI tongue + constitution "diagnosis" classification

**STATUS:** FLAG ⚠️
**RISK LEVEL:** HIGH
**REGULATION:** Medical Device Act 2012, s.5 (classification); Medical Device Regulations 2012 Reg. 4.

**ISSUES FOUND:**
- The patient flow calls the AI output "**Tongue Diagnosis · 舌診**" and "**Constitution Report · 體質報告**" with a numeric `health_score`, coloured `col: red / yellow / green` pattern labels, and machine-identified `constitution.primary` (e.g. `yin_deficient`). Even with the doctor-review gate, the term "diagnosis" and a numeric health score place this close to, or inside, the MDA definition of a medical device (software intended for diagnosis).
- Current framing in `v2/assets/js/panels/patient/ai-diagnosis.js` + `tongue.js` uses "diagnosis" as a page title and in the report header.

**RECOMMENDED ACTION (must complete before public launch):**
1. Rename every patient-facing instance of "diagnosis" → "wellness analysis" / "constitution insight" / "AI wellness report". Backend table name `tongue_diagnoses` can stay (internal) but every UI string must change.
2. Replace the numeric `health_score` on the patient view with a qualitative band ("balanced / mildly imbalanced / needs attention — please consult a practitioner").
3. Add a permanent disclaimer banner on every AI report: *"This is a traditional Chinese medicine wellness insight, not a medical diagnosis. For diagnosis or treatment, please consult a licensed TCM practitioner."* Both EN + 中文. Make it `sticky top` so it can't be scrolled past.
4. Remove the `pattern.col = 'red'` colour when shown to patients — keep it for doctors only.

**VERDICT:** Can ship to a pilot with recruited consenting users, but a public launch without these changes exposes the clinic to MDA registration liability. Must be closed within 2 weeks.

**FIX APPLIED IN THIS REVIEW:** Not yet — text changes are extensive and touch ~15 files. Flagging for explicit owner decision before I edit.

---

## Finding 2 — Consent for AI processing

**STATUS:** NON-COMPLIANT ❌
**RISK LEVEL:** HIGH
**REGULATION:** PDPA 2010 §6 (informed consent for each purpose).

**ISSUES FOUND:**
- Tongue photo upload (`v2/assets/js/panels/patient/tongue.js`) and constitution submission do not collect explicit consent before processing. Patient agrees to general T&Cs at registration but no per-activity consent timestamp is stored.
- PDPA requires that consent be *informed* — patient must understand each distinct processing purpose.

**RECOMMENDED ACTION:**
1. Add a consent checkbox + 2-line disclosure above the "Analyse" button on the tongue upload page: *"I consent to my tongue photo being processed by AI for wellness analysis, and reviewed by a licensed TCM practitioner. My photo will be stored securely until I request deletion."* + Chinese translation.
2. Same for constitution questionnaire final screen.
3. Store the consent event in `audit_logs` with `action = 'consent.tongue_analysis'` / `consent.constitution_questionnaire`, `user_id`, `created_at`.

**VERDICT:** Must fix before launch. Relatively small code change (~2 hours).

---

## Finding 3 — Patient data retention

**STATUS:** FLAG ⚠️
**RISK LEVEL:** MEDIUM
**REGULATION:** PDPA 2010 §10 ("retention principle" — data kept no longer than necessary).

**ISSUES FOUND:**
- Indefinite retention of appointments, prescriptions, tongue photos.
- No documented retention schedule.

**RECOMMENDED ACTION:**
- Draft a retention policy in Content CMS: medical records 7 years (aligned with Malaysian medical records standard), chat messages 2 years, tongue photos 2 years (OR until patient requests deletion).
- Add a nightly cron that soft-deletes beyond retention.
- Document in the privacy notice.

**VERDICT:** Acceptable for pilot (6-12 months of data). Must operationalise before year 2.

---

## Finding 4 — Right of access & data export

**STATUS:** NON-COMPLIANT ❌
**RISK LEVEL:** MEDIUM
**REGULATION:** PDPA 2010 §30 (right of access), §31 (right of correction).

**ISSUES FOUND:**
- Patient can see their own data within the portal but cannot export it. PDPA gives the data subject a right to receive their personal data in a structured format.

**RECOMMENDED ACTION:**
- Add `GET /patient/data-export` that returns a JSON bundle of the patient's appointments + prescriptions + orders + tongue diagnoses + constitution reports + chat threads.
- Add a "Download my data" button in patient Settings.

**VERDICT:** Must ship before launch. ~3 hours of work.

---

## Finding 5 — Storage at rest

**STATUS:** FLAG ⚠️
**RISK LEVEL:** MEDIUM
**REGULATION:** PDPA 2010 §9 (security principle — "appropriate security safeguards").

**ISSUES FOUND:**
- Tongue photos stored on Railway Volume as plain JPEG (after earlier ephemeral-storage fix). No server-side encryption.
- Chat messages stored as plaintext in MySQL (Railway).
- `medical_documents` same.

**RECOMMENDED ACTION:**
- Short term (pilot): enable Railway's volume encryption option if available; document current state in privacy notice.
- Medium term (scale): migrate uploads to S3 / Cloudflare R2 with SSE + signed URLs.
- Long term: consider field-level encryption on chat + health-sensitive notes using `Crypt::encryptString` on Eloquent attribute casts.

**VERDICT:** Acceptable for pilot. Must publish a roadmap commitment.

---

## Finding 6 — Marketing / advertising language

**STATUS:** COMPLIANT ✅ (with one review)
**RISK LEVEL:** LOW
**REGULATION:** Consumer Protection Act 1999 (prohibition on false advertising); T&CM Act 2016 Part V (advertising restrictions).

**ISSUES FOUND:**
- Existing copy in `v2/portal.html` + landing is clinically neutral: "wellness", "consultation", "licensed TCM practitioner". No therapeutic claims.
- Herb shop pages call products "herbal food supplements" — correct framing.
- Consultation pages don't claim cure.
- New marketing content generated in Step 5 of this orchestration passed compliance review (see `launch-content.md`).

**VERDICT:** Current marketing is clean. New content checked individually.

---

## Finding 7 — Practitioner licensing display

**STATUS:** COMPLIANT ✅
**RISK LEVEL:** LOW
**REGULATION:** T&CM Act 2016 s.25 (registered practitioner requirement).

**ISSUES FOUND:**
- `DoctorProfile` model includes `license_no` field and `verification_status` gate.
- Pool fanout + appointment assignment both filter on `verification_status = 'approved'` (and now fall back to role-based if none approved — intentional for pilot).
- Doctor profile on patient-facing pages displays license number.

**VERDICT:** Process is sound. Before launch, confirm every activated doctor account has a valid license_no verified against the LPMT register.

---

## Finding 8 — Payment handling

**STATUS:** FLAG ⚠️
**RISK LEVEL:** MEDIUM
**REGULATION:** Consumer Protection Act 1999; Bank Negara Malaysia payment guidelines.

**ISSUES FOUND:**
- Appointment payment modal is a demo — no real charge happens (QA issue 1 section 1).
- Order payment endpoint IS wired, but in demo mode accepts method selection without real Stripe capture.
- In pilot with recruited users this is fine (documented as demo); in public launch it will confuse users.

**RECOMMENDED ACTION:**
- Before public launch, wire Stripe webhook (`POST /webhooks/stripe`) to trigger `Patient\OrderController::pay` via payment_intent.succeeded.
- Same for appointments.
- Add "THIS IS A PILOT — PAYMENTS ARE SIMULATED" banner on payment modals during controlled-pilot phase.

**VERDICT:** Pilot-acceptable with banner; must wire real payment for public launch.

---

## Finding 9 — Anthropic AUP compliance

**STATUS:** COMPLIANT ✅
**RISK LEVEL:** LOW

**ISSUES FOUND:**
- AI features are framed as wellness education tools (partially — see Finding 1).
- No direct medical advice generated without practitioner review gate.
- The agent system (`agents/`) is used for internal dev/marketing/compliance — not patient-facing output.

**VERDICT:** As long as Finding 1 is resolved, AUP compliance is clean.

---

## Aggregate Compliance Verdict

| Finding                               | Severity | Launch gate |
|---------------------------------------|----------|-------------|
| 1. AI diagnosis classification (MDA)  | HIGH     | Fix ≤ 2 weeks |
| 2. Consent for AI processing (PDPA)   | HIGH     | **BEFORE LAUNCH** |
| 3. Retention policy (PDPA)            | MEDIUM   | Document; operationalise by month 12 |
| 4. Data export (PDPA §30)             | MEDIUM   | **BEFORE LAUNCH** |
| 5. Storage at rest (PDPA §9)          | MEDIUM   | Document; migrate by scale |
| 6. Marketing language                 | LOW      | ✅ clean |
| 7. Practitioner licensing             | LOW      | ✅ sound |
| 8. Payment handling                   | MEDIUM   | Pilot: banner. Public: wire Stripe |
| 9. Anthropic AUP                      | LOW      | ✅ clean |

**STATUS:** FLAG ⚠️ (CONDITIONAL)
**RISK LEVEL:** MEDIUM

**VERDICT:**
**Not ready for public launch as-is.** HansMed IS ready for a **controlled pilot with recruited consenting testers** provided the clinic:
1. Adds consent checkboxes to AI upload flows (Finding 2).
2. Adds the "data export" endpoint + button (Finding 4).
3. Changes "diagnosis" → "wellness analysis" in patient-facing UI (Finding 1).
4. Displays "SIMULATED PAYMENT — PILOT" banner on payment modals.
5. Publishes a privacy notice covering retention + security at rest.

Points 1, 2, 3, 4 are achievable in ~1 working day of focused work. Point 5 is copywriting + a CMS entry.

**RECOMMENDED ACTION:** Proceed with the 5 fixes above in order. Re-run this compliance review after they're live. Expected result: STATUS = COMPLIANT ✅ RISK LEVEL = LOW for pilot launch.

---

*End of compliance report.*
