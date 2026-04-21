# HansMed Pilot Readiness Checklist

**Version:** 1.0
**Date:** 2026-04-21
**Use:** Single-page gate between "build" and "pilot go-live". Every box must be ticked and dated.

## Code completion (engineering owns)

- [ ] `composer install` in `backend/` — dependencies present, autoload works
- [ ] Docker compose stack comes up cleanly — `docker compose up -d` returns all healthy
- [ ] Database migrated + seeded (demo users, practitioners, inventory)
- [ ] `consent_grants` table migrated
- [ ] `GET /patient/data-export` endpoint implemented
- [ ] Shipping cost rule implemented (RM 10 West / RM 20 East flat rate, replacing `// TODO` in OrderController)
- [ ] Simulated-payment banner component present on checkout, POS, confirmation, email, PDF
- [ ] Payment routes short-circuit to simulated path (no real PSP call in pilot)
- [ ] All automated tests pass (`php artisan test`) — auth, booking, prescription, stock, consent (new)
- [ ] Frontend renders disclaimers D1–D5 per compliance-copy-changes.md
- [ ] Copy grep audit returns zero unapproved hits for `diagnosis`, `cure`, `guaranteed`, `FDA` on patient routes
- [ ] Language toggle EN / BM / 中文 works on disclaimers and banner

## Legal / compliance (this coordinating Claude delivered drafts; counsel must finalize)

- [ ] Privacy Notice (`docs/legal/privacy-notice.md`) placeholders filled and reviewed by Malaysian counsel
- [ ] Terms of Service drafted and reviewed by counsel *(not yet drafted — flag for next sprint)*
- [ ] Practitioner Services Agreement reviewed by counsel
- [ ] Data Processing Agreement reviewed by counsel
- [ ] AI-assisted practice acknowledgment reviewed
- [ ] DPO email `privacy@hansmed.my` monitored by a named individual
- [ ] Registered company entity in place with registered office address listed in Privacy Notice

## Operations

- [ ] Pilot practitioner onboarding complete (2 practitioners, all 6 stages — see `onboarding/practitioner-sop.md`)
- [ ] Pilot patient list curated (10 invitees)
- [ ] Invite email drafted and scheduled
- [ ] On-call rotation for pilot week defined (primary + backup)
- [ ] Incident response runbook in place — contact tree for practitioner, patient, DPO, engineer
- [ ] Daily standup scheduled for pilot week

## QA sign-off

- [ ] Pilot test plan (`docs/testing/pilot-test-plan.md`) P0 scenarios pass twice consecutively
- [ ] P1 scenarios pass at least once
- [ ] Mock DSAR (data subject access request) run end-to-end within 21-day SLA
- [ ] Backup + restore rehearsed once on staging

## Business

- [ ] Pricing for pilot (even if simulated payments) decided and communicated
- [ ] Post-pilot survey built (SurveyMonkey / Google Forms)
- [ ] Success metric thresholds set (e.g. NPS > 30, zero safety incidents, ≥ 80% patients complete one consult)

## Sign-off

| Role | Name | Date |
|---|---|---|
| Product lead | | |
| Engineering lead | | |
| Compliance lead | | |
| Ops lead | | |

## GO / NO-GO

Pilot is **GO** only when every box above is ticked and all four sign-offs are dated. Any unchecked box must have a documented exception approved by the product lead and compliance lead.

---

## Items deferred to post-pilot

- Real payment integration (Stripe or local PSP)
- BNM e-money / payment aggregator licensing review
- SEO / marketing launch campaign
- Mobile apps
- Multi-clinic inventory federation
- Telemedicine controlled-substance workflow (requires separate licensing)
