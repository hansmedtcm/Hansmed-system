# HansMed — Pre-Launch Readiness Report

**Orchestration date:** 2026-04-21
**Orchestrator:** HansMed Agent System (`agents/src/index.ts`)
**Scope:** Full platform — patient / doctor / pharmacy / admin portals + AI diagnosis + pharmacy dispensing + admin finance & voucher.

---

## 1. QA Score

**Overall: 7.3 / 10** (see `agents/reports/qa-report.md`)

| Area                | Score  |
|---------------------|--------|
| Booking system      | 7/10   |
| Doctor portal       | 8/10   |
| Patient portal      | 7/10   |
| Pharmacy portal     | 8/10   |
| Admin console       | 8/10   |
| PDPA data handling  | 6/10   |

No hard blockers. PDPA hygiene drags the average down — addressable with the 5 compliance items below.

---

## 2. Compliance Verdict

**CONDITIONAL** — *ready for controlled pilot; not ready for public launch yet.*

See `agents/reports/compliance-report.md` for full detail.

**Must-fix before PUBLIC launch (in order):**

1. **Consent for AI processing** (PDPA §6) — add checkbox + audit log on tongue upload and constitution questionnaire. ~2 hours.
2. **Data export endpoint** (PDPA §30) — `GET /patient/data-export` returning JSON of all own records. ~3 hours.
3. **"Diagnosis" → "Wellness analysis" copy change** (MDA 2012) — rename ~15 patient-facing strings. ~1 hour.
4. **Pilot-mode banner on payment modals** — "SIMULATED PAYMENT" until Stripe webhook wired. ~30 min.
5. **Privacy notice** covering retention + security-at-rest — 1 page in Content CMS. Copywriting task.

Total effort to reach "COMPLIANT ✅": **~1 working day of focused engineering + ~2 hours of copywriting.**

**Must-plan but not a launch blocker:**
- Retention cron (year 2).
- S3 migration for photos (when scaling past pilot).
- Granular admin permissions (when >1 admin user).
- Real Stripe webhook for public launch.

---

## 3. Issues Found & Fixed During Review

Genuine bugs that surfaced during the orchestration review and were fixed in earlier commits:

| # | Issue | Status |
|---|-------|--------|
| 1 | Patient booking silently failed due to UTC/local time-zone mismatch in `computeEnd`. | ✅ Fixed |
| 2 | Fee breakdown crashed with "foreach not a function" on legacy JSON-shape `treatments` rows. | ✅ Fixed |
| 3 | Pharmacy stock not decrementing after dispense due to 繁↔簡 Chinese + middot format mismatch. | ✅ Fixed + admin reconcile button |
| 4 | Finance "By Doctor" table ignored revenue from doctors without completed appointments but with paid Rx orders. | ✅ Fixed |
| 5 | `<img onerror>` was spilling raw HTML onto the page on 404. | ✅ Fixed with `HM.imgFallback` helper |
| 6 | Chat threads showed "Patient #3" instead of real names because raw `DB::table` had no join. | ✅ Fixed |
| 7 | Voucher reconcile endpoint matched `{id}=reconcile` as wildcard and returned "POST not supported". | ✅ Fixed route ordering |
| 8 | `HM.auth.token is not a function` blocked every notification poll. | ✅ Fixed with probe-and-fallback |

Issues flagged but **not yet fixed** (reserved for owner decision):

| # | Issue | Status |
|---|-------|--------|
| 9 | Appointment payment modal is decorative — no real capture. | ⏳ Pilot: banner. Public: wire Stripe. |
| 10 | "Diagnosis" language in patient UI (MDA classification risk). | ⏳ Awaiting owner sign-off on new copy. |
| 11 | No consent capture on AI uploads. | ⏳ ~2 hours to build. |
| 12 | No data-export endpoint. | ⏳ ~3 hours to build. |

---

## 4. Marketing Content Status

Three launch posts generated and **all three cleared compliance** (see `agents/reports/launch-content.md`).

| Post                            | Status      | Safe to publish |
|---------------------------------|-------------|-----------------|
| 1. Platform launch announcement | COMPLIANT ✅ | Yes            |
| 2. Tongue analysis education    | COMPLIANT ✅ | Yes            |
| 3. Herb shop intro              | COMPLIANT ✅ | Yes            |

Bilingual (EN + BM), all with explicit practitioner-consult disclaimers, no therapeutic claims.

---

## 5. API Cost for This Orchestration

**$0.00** — no Anthropic API calls were made. The agent scaffolding is wired correctly (`caller.ts` now has proper `x-api-key` + `anthropic-version` headers), but no `ANTHROPIC_API_KEY` was set in the env, and the review was produced by the underlying Claude model reading the actual codebase and applying the agent system prompts directly.

If you want to run it via real API calls:

```bash
cd agents
export ANTHROPIC_API_KEY='sk-ant-…'
npx ts-node src/index.ts auto "write a launch announcement for HansMed"
```

Sonnet 4 pricing ($3/M input, $15/M output) — the cost for a run roughly equivalent to this orchestration would be **~$0.05–0.15** depending on how verbose the agents get.

---

## 6. Final Launch Recommendation

**🟡 CONDITIONAL — GO FOR PILOT, HOLD ON PUBLIC LAUNCH.**

### Ship now (controlled pilot ≤ 50 users):
- Invite-only recruitment with explicit consent on signup.
- "Pilot programme — simulated payments" banner.
- Weekly feedback loop; fix issues as they surface.
- Document the 5 compliance gaps as known-limitations given to pilot users.

### Before the public launch (recommended sequence):
1. Day 1–2: implement consent checkboxes + data export endpoint (5 hrs engineering).
2. Day 3: rename "diagnosis" → "wellness analysis" across patient UI (1 hr).
3. Day 4: publish privacy notice + retention policy in Content CMS.
4. Day 5: wire Stripe webhook (`POST /webhooks/stripe` already scaffolded — needs event routing).
5. Day 6: re-run this agent orchestration (or ask for a focused re-review) to confirm COMPLIANT ✅.
6. Day 7: public launch.

### What looks strong:
- Platform functionality is 80% there, many flows polished across recent work.
- Notification + synthesis + clinical-assist are genuine differentiators.
- Compliance framing in content is clean — just the UI terminology + consent flow need tightening.
- All 3 launch posts passed compliance first pass, no rewrites needed.

### What to keep an eye on post-launch:
- Storage migration from Railway Volume to S3 when active users > 200.
- Real Stripe webhook before first real RM is charged.
- Granular admin permissions once the clinic has multiple admin users.
- Audit log viewer ergonomics when volume exceeds ~10k entries.

---

## Files produced

- `agents/reports/qa-report.md` — 320 lines, 6 feature areas
- `agents/reports/compliance-report.md` — 9 findings against 5 regulations
- `agents/reports/launch-content.md` — 3 approved posts in EN + BM with Canva briefs
- `agents/reports/launch-readiness.md` — this file

---

*End of pre-launch readiness report.*
