# HansMed Pilot Test Plan

**Version:** 1.0
**Date:** 2026-04-21
**Scope:** Gate between current build and "ready for closed pilot with 1–2 practitioners + 10 invited patients"
**Owner:** QA (coordinating Claude) / executed by engineering

## Success definition for pilot

A pilot is **GO** when every P0 scenario below passes two consecutive runs on a clean database, AND every P1 scenario passes at least once.

## Environments

- **Local:** docker-compose up, seeded with demo data — for development
- **Staging:** identical stack on a single VM, public URL, SSL, real domain (pilot.hansmed.my) — for UAT
- **Production:** not in scope for this test plan

## Test Data

Seed script should produce:
- 2 patients (Patient A — English / Patient B — BM)
- 2 practitioners (Dr. Wong — licensed, active / Dr. Lim — licensed, inactive)
- 1 admin
- 1 pharmacy staff
- 10 inventory items (herbs + formulas)
- 5 historical consultations
- 3 booking slot rules (weekday, weekend, blocked)

## Scenarios

### P0 — Must pass before pilot

#### T01 — Patient sign-up and consent
1. Open `/register`, fill form, submit
2. Verify: account created, email verification sent
3. Log in, land on dashboard
4. Click Tongue Scan → consent modal M1 appears
5. Tick required consent, upload photo → wellness analysis page
6. **Pass criteria:** consent audit row written with correct `purpose_id`, `consent_version`, `ip`; AI output shows D1 disclaimer; no use of word "diagnosis" on page

#### T02 — Book, consult, receive recommendation
1. Patient A searches practitioners, picks Dr. Wong
2. Select slot, trigger M3 consent modal, confirm
3. Checkout: simulated-payment banner visible, click Pay
4. Booking confirmed, appears in Dr. Wong's portal
5. Dr. Wong joins video consult (Jitsi/Twilio), issues recommendation
6. Patient sees recommendation in portal
7. **Pass criteria:** no double-booking possible (attempt to book same slot fails with friendly error); recommendation PDF shows D4 footer with practitioner registration

#### T03 — Pharmacy fulfillment
1. Dr. Wong's recommendation becomes an order (patient approves)
2. Pharmacy staff sees order in queue
3. Marks items picked; inventory decrements
4. Shipping cost calculated: RM 10 (West MY address) / RM 20 (East MY address)
5. Order moves to `shipped`
6. **Pass criteria:** inventory reflects pick; if insufficient stock, order blocked with clear error; shipping cost matches flat-rate rule

#### T04 — Consent revocation and data export
1. Patient A → Account → Privacy
2. Revoke `ai_processing` consent
3. Verify: future tongue uploads blocked with message "AI processing consent required"
4. Click Request Data Export
5. Verify: endpoint returns 202, job queued, email arrives with ZIP link within 21 days SLA (for test, verify job exists in queue)
6. **Pass criteria:** revocation row written; AI endpoints refuse with 403 when consent absent; export ZIP contains user's profile, uploads, questionnaire answers, consultations, consent history

#### T05 — Simulated payment banner presence
1. Visit checkout, POS, order confirmation, receipt PDF, confirmation email
2. **Pass criteria:** banner visible on all 5 surfaces in EN, BM, and 中文; banner cannot be dismissed

#### T06 — PDPA disclaimers rendered
1. Visit tongue upload, questionnaire, AI output page, site footer
2. **Pass criteria:** D1, D2, D3, D5 all present and not collapsed; text matches compliance-copy-changes.md exactly

#### T07 — Role-based access control
1. Log in as Patient A, try to hit `/api/admin/users` → 403
2. Log in as Dr. Wong, try to read Patient B's records (not his patient) → 403
3. Log in as Pharmacy, try to read consultation notes → 403 (only see items to fulfill)
4. **Pass criteria:** unauthorized endpoints return 403 with no data leakage in error messages

#### T08 — Practitioner license gate
1. Try to assign consultation to Dr. Lim (inactive license)
2. **Pass criteria:** system blocks with message "Practitioner not currently accepting bookings"; active status linked to T&CM registration flag

### P1 — Should pass before pilot

#### T09 — Language toggle
- Switch to BM, verify core screens translated; switch to 中文, same
- Pass: disclaimers, banner, and consent modals translate; no untranslated strings on primary flows

#### T10 — Video consult graceful degradation
- Patient joins with mic blocked → clear permission prompt
- Network drops → reconnect banner, state preserved

#### T11 — Offline / flaky network
- Simulate 3G, flight mode briefly, recover
- Pass: bookings don't double-submit; form state preserved

#### T12 — Email deliverability
- Signup, booking confirmation, order confirmation, data export all deliver within 2 min (test with Mailtrap / real inbox)

#### T13 — Admin reports
- Daily booking count, top practitioners, top SKUs
- Pass: numbers match database truth

### P2 — Nice to have, not blocking

- Performance: home page TTFB < 600 ms on staging
- Lighthouse accessibility > 85 on patient dashboard
- SEO: meta tags and sitemap present

## Regression suite (automated)

Already present per backend tests:
- Auth flow
- Booking conflict detection
- Prescription issuance
- Stock management

Add before pilot:
- Consent grant/revoke endpoints
- Data export endpoint
- Copy audit (grep test) for disallowed words

## Exit criteria — pilot GO/NO-GO

| Item | Status |
|---|---|
| All P0 pass twice consecutively | [ ] |
| All P1 pass at least once | [ ] |
| Privacy notice published at /privacy | [ ] |
| Terms of service published at /terms | [ ] |
| Practitioner onboarding SOP run for pilot practitioners | [ ] |
| Simulated payment banner visible everywhere | [ ] |
| No `diagnosis` / `cure` / `guaranteed` strings on patient routes | [ ] |
| Backup and restore rehearsed once | [ ] |
| Incident escalation on-call defined | [ ] |
| DPO email monitored | [ ] |

Sign-off required from: Product lead, Compliance lead, Engineering lead.

## Known risks entering pilot

1. **No real payments** — deliberate. Mitigation: simulated banner + no real charges code path.
2. **Single AI vendor dependency** — outage blocks tongue analysis. Mitigation: graceful degradation message + allow practitioner booking without AI output.
3. **T&CM practitioner supply** — only 2 practitioners onboarded; availability bottleneck. Mitigation: limit pilot to 10 patients.
4. **PDPA novelty** — we have not yet been audited. Mitigation: run a mock DSAR (data subject access request) before pilot.

## Post-pilot review (week 2)

Collect from pilot users:
- Consent modal comprehension (5-point survey)
- Would-pay willingness (for price-setting after real payments)
- Wellness analysis perceived value
- Any "feels like a diagnosis" framing issues — fix immediately
