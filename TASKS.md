# HansMed — Open Tasks

**Last updated:** 2026-05-02 (CEO/Cowork session)
**How to use:** check items off as they ship. Add new items at the bottom of the right priority section. Both mobile-Claude (in the HansMed CEO project on claude.ai) and desktop-Cowork can read this file.

---

## ✅ Recently shipped (this week)

- [x] Edit-in-consult bug — case record + treatments lost on rx tab redirect (Briefs #1, #1b — frontend defensive parse + backend double-encoding fix)
- [x] Patient case history viewer — body diagram restoration (Briefs #2, #2b, #2c, #2d — display + bake fixes for silhouette layering and aspect ratio)
- [x] Home page herb shop CTA → "Coming Soon" when shop disabled (Brief #3)
- [x] Services page herb shop CTAs → "Coming Soon" + onclick typo fixes (Brief #3b)
- [x] v3/index.html — homepage refactor with brand spine, founder story, AI Wellness CTA, placeholder practitioner section (Brief #4 — shipped as v3 preview alongside live v2)
- [x] v3/index.html — interactive Tongue Map widget + tongue types strip (Brief #6)
- [x] v3/index.html — organ clock education layer with intro context, click-to-view-info, all-organs toggle, modal for all 12 organs (Brief #7 — including View-info CTA replacing Book CTA)
- [x] v3/index.html — visual upgrade: imagery, smooth scroll, scroll reveals, parallax hero, card tilt, image fade-in, spacing reverence, rice-paper texture (Brief #8)
- [x] v3 fixes: tongue tip/root orientation correction; ink-wash divider opacity (then removed entirely); mobile scroll lag (Lenis + parallax guards changed AND→OR + bumped to 1024px); WebP conversion (61MB → 1MB page weight); decorative emoji removal from cards; scroll-reveal timing snappier
- [x] Compliance — Privacy Policy + ToS first drafts at compliance/ folder; lawyer engagement guide ready
- [x] Brief #14a — Constitution Card component (in v2) + clean portal URL [2026-05-04] — extracts `HM.constitutionCard` to `v2/assets/js/components/constitution-card.js` (single source of truth: DIMS, QS, FOLLOW_UPS, HERB_MAP, getConstitution, buildLifestyleTips, plus 6 renderers). Doctor's Constitution Questionnaire detail modal now shows readable q1-q10 + dimensions + patterns + advice + tongue (was raw JSON / `[object Object]`). Patient view refactored to consume from the same component (no behavior change). Adds root-level redirects `/portal.html`, `/doctor.html`, `/pharmacy.html`, `/admin.html` so partner referrals see clean URLs instead of `/v2/portal.html`. v3 nav updated to use the clean URLs.

## 🚀 In progress

- [SUPERSEDED] **Brief #5 — Constitution Questionnaire history on patients page.** → Replaced by Brief #14a (Constitution Card component) which solves the underlying JSON-dump issue more comprehensively by giving doctor + patient views a shared `HM.constitutionCard` source of truth. Brief #5's collapsible-section markup + modal scaffolding had already shipped earlier; the missing piece was readable rendering, which #14a delivers.
- [ ] **Brief #9 — v3/about.html clean rebuild.** v2/about.html is currently 1632 lines with ~1500 lines of duplicated home/services/contact content surrounding only ~65 lines of actual about material. Rebuild as a clean single-purpose v3 page with warmth treatment (image hero, scroll reveals, bilingual, rice-paper texture). Preserves the existing solid copy (Why we built HansMed, Three things we never compromise on, stats grid).
- [ ] **Brief #10 — v3/services.html clean rebuild.** Same approach as Brief #9. Strip duplication, build clean services page with warmth treatment.
- [ ] **Brief #11 — v3/practitioners.html clean rebuild.** Same approach. Will use placeholder practitioner imagery until real practitioner content is collected.
- [ ] **Compliance — engage Malaysian health-tech lawyer.** See `compliance/lawyer-engagement-brief.md`. Send email template to 1-2 candidate lawyers, get fixed-fee quote (RM 1,500-3,500 expected) for review of `compliance/privacy-policy.md` + `compliance/terms-of-service.md`. Fill in [INSERT] placeholders before sending.
- [PLANNED] **Brief #14b — Shareable Constitution Card (marketing).** Uses the `HM.constitutionCard` component built in #14a; designs a polished export-as-image / shareable card a patient can post on WhatsApp / Instagram after their wellness assessment. No code duplication thanks to #14a.
- [PLANNED] **Brief #15+ — v3 portal migration.** Move `HM.constitutionCard` to `v3/assets/js/components/constitution-card.js`; build v3 portal/doctor/pharmacy/admin pages; flip the root-level `/portal.html`, `/doctor.html` etc. redirects from `v2/...` to `v3/...`. Component move is one path change + grep-and-replace across the two `<script src>` lines in v2/doctor.html and v2/portal.html (or whatever the v3 staff pages end up calling them).

## 🔥 High priority (next up after Brief #4 lands)

- **Patients page hide-toggles + tongue history view** — investigated 2026-05-02; status:
  - [x] Hide-toggle for DOB analysis section — shipped + verified live by user 2026-05-02 (`patients.js:280`, collapsibleSection key `'dob'`)
  - [x] Hide-toggle for tongue analysis section — shipped + verified live by user 2026-05-02 (`patients.js:315`, collapsibleSection key `'tongue'`)
  - [x] Tongue analysis history view — shipped + verified live by user 2026-05-02 ("📜 View All" → `openTongueHistoryModal`; individual cards clickable to detail modal)
  - [ ] **Constitution Questionnaire history view — NOT shipped, queued as Brief #5.** Quiz/questionnaire is a separate clinical artifact from the tongue assessment (table: `questionnaires`, kind: `ai_constitution_v2`). Doctor's patient profile doesn't currently show a patient's questionnaire submission history. Brief #5 adds the backend field + frontend collapsible section + detail/history modals using the same UX pattern as tongue.
- [ ] **About / Services / Practitioners pages refactor** to match Brief #4 warmth direction. Same approach: preserve content, soften copy, restructure for clarity. Do after Brief #4 lands and the new tone is validated.

## 🟡 Medium priority

- [ ] **Tongue photos disappearing on Railway** — storage/volume issue. Was partially addressed but recurred Apr 28. Need to investigate whether Railway volume is being recreated on deploy, and if so, move tongue uploads to S3-compatible object storage (e.g. R2, Backblaze B2) for durability.
- [ ] **Medicine stock not reliably decrementing** when pharmacy dispenses. Was worked on but confirmation of fix is unclear from prior session log. Verify with a real dispense flow.
- [ ] **Language switching broken** in several pages: article pages, mobile drawer, some portal areas. Audit + fix.

## 🛡️ Tech debt (do after launch milestones, not urgent)

- [ ] **Pest regression test for AppointmentController::show** that asserts `consultation.case_record` is an object (not string) and `consultation.treatments` is an array. Locks in the Brief #1b fix. ~20 min.
- [ ] **Frontend smoke test** for the case-history rehydration if you have a JS test runner. Optional.
- [ ] **One-time DB migration** to clean double-encoded historical `consultations.case_record` and `consultations.treatments` rows. Loop, decode once, re-save. Optional — Task A frontend fallback handles them silently. Flag for cleanup, not crisis.
- [ ] **Dead code cleanup** in `consult.js:rehydrateCaseRecordForm()` — the `body_front`/`body_back` branch never fires because the markup only emits `data-side="combined"`. Body restoration goes through `initBodyDiagram()` instead. Remove dead branch.
- [ ] **Auth token storage hardening** — currently in localStorage (XSS-vulnerable). Move to HttpOnly cookies + CSRF tokens. Bigger refactor, do when serious public launch is near.
- [ ] **Raw SQL audit** — 29 occurrences across 7 backend controllers. Most are likely safe Laravel idioms with parameter binding. One-pass audit to confirm no `whereRaw()`/`selectRaw()` takes user input without binding. Half-day.

## 🔒 Pre-launch must-do (deferred but tracked)

- [ ] **Security headers** — Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, etc.
- [ ] **CORS lockdown** — restrict to specific origins for production.
- [ ] **Stripe real-payment webhook** — currently simulated. Wire up real Stripe webhook signature verification + production keys.
- [ ] **Rate limiting** on auth endpoints (login, register, password reset). Mentioned in earlier security notes as deferred.
- [ ] **Account lockout** after N failed login attempts.
- [ ] **DPO / contact published** for PDPA requests once compliance docs are live.

## 💡 Ideas / parking lot (someday-maybe)

- [ ] **Visual rebrand pass** with a real Malaysian designer once practitioner content (photos, bios, stories) is collected. Q3 2026 candidate.
- [ ] **Patient testimonials collection** — design opt-in flow for early patients to share their stories. Feeds the "What patients say" placeholder added in Brief #4.
- [ ] **Practitioner content collection** — photos, bios, lineages, specialties, video intros. Unblocks the practitioner section on every public page. Big content lift.
- [ ] **PDF export of case records** for patients (regulatory + portability under PDPA). Self-contained body diagrams from Brief #2b's bake will help here.
- [ ] **Wearable / app integration** — future feature, not near-term.
- [ ] **B2B partnerships** — once compliance docs are live, can pursue corporate wellness, insurance, hospital tie-ins.

---

## Notes for whoever updates this

- Add new items at the bottom of the right section. Don't reorder existing items.
- When something ships, move it to "Recently shipped" with the brief number.
- "Recently shipped" gets pruned to last 7 days at the start of each new week — older items move to git history.
- One bullet per task. If a task needs sub-tasks, indent them under the parent.
