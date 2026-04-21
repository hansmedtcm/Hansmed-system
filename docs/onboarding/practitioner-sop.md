# Practitioner Onboarding SOP — HansMed

**Version:** 1.0
**Date:** 2026-04-21
**Owner:** Operations
**Purpose:** Standard operating procedure for onboarding a TCM practitioner to the HansMed platform so that patient-facing services meet Malaysian regulatory standards and Claude Usage Policy.

## Regulatory reference

- **Traditional and Complementary Medicine Act 2016 (Act 775)** — requires T&CM practitioners to be registered with the Malaysian T&CM Council (MTCM) to practice for reward.
- **Medical Device Act 2012** — distinguishes software providing general wellness information (allowed) from software providing clinical diagnosis (regulated).
- **PDPA 2010** — practitioners handling patient data on our platform are co-data-users with HansMed; requires a Data Processing Agreement.

## Onboarding stages

### Stage 1 — Application (day 0)

Practitioner submits via `/practitioners/apply` or assisted form. Required fields:
- Full name (as per IC/passport)
- IC number or passport
- T&CM Council registration number (APC — Annual Practising Certificate)
- Field of practice (Acupuncture / Herbal / Tui Na / Shang Han / etc.)
- Years of experience
- Clinic / practice address
- Upload: APC PDF or photograph
- Upload: Professional indemnity insurance certificate
- Upload: IC front + back

**Action:** Ops receives application alert via admin portal.

### Stage 2 — License verification (day 1–3)

Ops verifies APC by:
1. Cross-checking registration number on the MTCM Council public register (https://tcm.moh.gov.my — assume manual lookup for pilot)
2. Confirming APC validity dates cover the onboarding period
3. Confirming field of practice matches what the practitioner declared

**Pass:** update `practitioners.license_verified = true`, set expiry reminder 30 days before APC expires.

**Fail:** reject application with reason; retain record for 24 months.

### Stage 3 — Background and reference check (day 2–5)

- Request 1 professional reference (another registered practitioner or clinic owner)
- Simple background check: any public disciplinary actions, bankruptcy, court cases
- Google + LinkedIn review

**Pass:** proceed to Stage 4.

### Stage 4 — Contracts and compliance (day 4–7)

Send for e-signature:

1. **Practitioner Services Agreement** — covers fee split, payment timing, dispute resolution, termination, code of conduct
2. **Data Processing Agreement (DPA)** — PDPA co-data-user clauses: confidentiality, breach notification, security standards, data return on exit
3. **Platform Code of Conduct** — clinical boundaries (no telemedicine prescribing for controlled substances; no diagnosis of conditions outside T&CM scope; referral to allopathic care when red flags appear)
4. **AI-assisted practice acknowledgment** — practitioner acknowledges they, not the AI, are responsible for clinical decisions; they must not rubber-stamp AI output

**Pass:** all four signed. Store PDFs in `practitioner_documents` table with checksum.

### Stage 5 — Platform training (day 7–10)

Scheduled 60-minute session (video) covering:
- Portal walkthrough
- Consent model — what the patient agreed to, what practitioner can/can't see
- Writing recommendations (proper language — "suggest", "recommend", not "diagnose")
- Red-flag referral triggers (chest pain, severe weight loss, blood in stool, pregnancy symptoms outside scope — refer to MD)
- Payment and payout schedule
- Dispute handling
- PDPA essentials
- How to use the (disabled during pilot) video consult tool

Written knowledge check (10 questions, pass = 8/10) before activation.

### Stage 6 — Activation (day 10)

- Flip `practitioners.active = true`
- Assign available slots per practitioner's submitted schedule
- Announce to pilot patients via curated email
- Set 7-day check-in

## Ongoing monitoring

- **Monthly:** audit 5% of recommendations for compliance language
- **Quarterly:** patient satisfaction survey per practitioner
- **Annually:** APC renewal check (automated reminder at 30 / 14 / 7 / 0 days before expiry; auto-suspend if expired)
- **Per incident:** complaint workflow → investigation → if founded, warning → suspension → termination

## Suspension / termination

Immediate suspension triggers:
- APC lapsed or revoked
- Credible complaint of patient harm
- Breach of confidentiality (sharing patient data)
- Claiming to "cure" diseases or recommending patient stop prescribed medication

Process: 24-hour notice, account frozen, patients notified, records archived. Formal review within 14 days.

## Pilot-specific notes

- **Pilot practitioner count:** 2 (Dr. Wong active, Dr. Lim inactive for inactive-license testing)
- **Pilot patient cap per practitioner:** 5
- **All pilot consultations recorded** (with patient + practitioner consent) for quality review — delete after 90 days

## Documents to produce / link

- [ ] Practitioner Services Agreement template — engage Malaysian counsel
- [ ] Data Processing Agreement template — align with PDPA 2010
- [ ] Code of Conduct — internal draft OK for pilot, counsel review before public launch
- [ ] AI-assisted practice acknowledgment — internal draft OK for pilot
- [ ] Training deck + knowledge check — internal
- [ ] Onboarding tracker spreadsheet — Ops Google Sheet

## Acceptance criteria — pilot ready

- [ ] 2 practitioners completed all 6 stages
- [ ] All 4 signed documents on file per practitioner
- [ ] Knowledge check pass on file
- [ ] APC verified and expiry reminder set
- [ ] Backup practitioner identified for coverage
