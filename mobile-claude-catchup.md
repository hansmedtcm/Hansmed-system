# HansMed — Mobile-Claude Catch-Up Snapshot

**Last updated:** 2026-05-03
**For:** mobile-Claude (HansMed CEO project on claude.ai)
**Purpose:** brings mobile-Claude up to date on everything that's happened since the project was first set up.

> **Instructions for the user:** upload this file to your "HansMed CEO" project on claude.ai (replacing the previous catchup if there is one). Mobile-Claude will then know the current state when you ask "what are we working on" or "what's next." Re-generate this every 1–2 weeks by asking desktop-Cowork "regenerate mobile-claude catchup."

---

## Where the build is right now (one-paragraph summary)

HansMed is mid-redesign. The live site (v2/) at `hansmedtcm.github.io/Hansmed-system/v2/` is unchanged from before this redesign work began. A parallel preview site (v3/) lives at `hansmedtcm.github.io/Hansmed-system/v3/` with four redesigned pages: index (homepage), about, services, practitioners. Each v3 page has the warmth treatment (centered radial overlay hero, image-led sections, neutralized scroll reveals, snappy load) and the cleaner single-purpose information architecture (no v2-style copy-pasted-page duplication). v2 stays live to real visitors until v3 is fully approved and we cut over.

## Major work shipped recently (briefs #1 through #11)

- **Brief #1 / #1b** — Edit-in-consult bug fixed. Backend was double-encoding case_record + treatments JSON; frontend now defensively parses both shapes. Patient case-record fields rehydrate correctly when re-entering a completed consult from the prescription tab.
- **Brief #2 / #2b / #2c / #2d** — Patient case-history viewer body diagram. Save side now bakes the silhouette into the canvas; display side layers silhouette under historical drawing-only saves; aspect ratio matches consult page (7:8) so strokes line up; modal sized at 600-700px wide for proper viewing.
- **Brief #3 / #3b** — Shop-disabled "Coming Soon" CTAs on home page and services page. Tied to admin's existing `shop_enabled` toggle. Old v2 buttons that incorrectly routed to `go('services')` or `go('register')` were also fixed to `go('shop')` so they actually go to the shop when enabled.
- **Brief #4** — v3/index.html homepage refactor. Brand spine ("Modern technology / Traditional TCM wisdom / Where old meets new") in hero, founder voice brand-story section, AI Wellness as primary CTA, placeholder practitioner section, "what patients say" placeholder.
- **Brief #5** — Constitution Questionnaire history on doctor's patients page (still queued, not yet shipped — adds a third collapsible section parallel to DOB and tongue analysis).
- **Brief #6** — Interactive AI Tongue Analysis widget on v3 home. Two tabs: stylized SVG tongue with 6 hover/click TCM organ zones; common-tongue-types strip with 8 sample analyses in modals. Tongue tip/root orientation was wrong on first ship — corrected (root at top of SVG = back of mouth, tip at bottom = front).
- **Brief #7** — Live Organ Clock education layer on v3 home. "Body wisdom · Did you know your liver peaks at 2 AM?" intro, "Your body has a 24-hour rhythm" explanation moved ABOVE the clock. Default behavior: only currently-active organ clickable; "Explore all organs" toggle unlocks every wedge. Modal opens with full TCM theory + modern function + common imbalances + when to seek care for all 12 organs. Booking CTA replaced with "View [Organ] info" CTA → opens the same modal (booking still inside the modal).
- **Brief #8** — v3 visual upgrade: imagery, smooth scroll, parallax hero, card tilt, image fade-in, generous spacing, rice-paper texture (subtle, kept), ink-wash dividers (added then REMOVED — too prominent).
- **Brief #9** — v3/about.html clean rebuild. Hero with practitioner-pulse image, "Why we built HansMed" 2-column with stats grid, "Our practice" section with empty-clinic image, "Three things we never compromise on" cards (the 醫/私/質 seal characters were tried and removed — cards now match home page no-icon style), CTA section.
- **Brief #10** — v3/services.html clean rebuild. Hero, "Which service is right for you?" comparison table, three service detail sections with alternating image left/right, per-service FAQ (4 items each), cross-service FAQ (5 items), bottom dark CTA. Pricing fields use `[PRICE: TBD]` placeholders for the user to fill in.
- **Brief #11** — v3/practitioners.html clean rebuild. Hero, T&CM Council licensing-explainer 4-card section, 3 placeholder profile cards using empty-clinic image, "How we examine you" section with the four classical TCM diagnostic methods (望聞問切) and brand-story image, "Three ways to get matched today" practical action section, bottom dark CTA.

## Major fix-up rounds along the way

- **WebP conversion:** v3 imagery was 61MB total in PNG → converted to WebP at quality 82 → now ~1MB total. 60× page-weight reduction.
- **Hero text contrast:** the centered radial overlay treatment was applied universally (Rule #11 in the project setup) so any new v3 sub-page hero gets readable text automatically.
- **Nav links cross-update:** every time a new v3 page shipped, the dropdown link in EVERY existing v3 page had to be updated from `../v2/X.html` to `X.html`. Now baked into Rule #11 to never repeat.
- **Reveal animations neutralized:** scroll-reveal opacity-0 transitions felt slow vs v2's natural load — `.reveal` class kept as a hook but CSS forces opacity:1 with !important so v3 loads as smoothly as v2.
- **Decorative emojis removed:** service cards, how-it-works steps, principle cards all had emoji icons that read unprofessional → all removed. Cards rely on hero images (services), numbered ordinals (steps), or just headings (principles).
- **Mobile scroll lag:** Lenis smooth scroll guards + hero parallax guards changed from AND-to-OR + bumped breakpoint to 1024px so any touch device or sub-1024px viewport gets native scroll, no jank.

## Current open tasks (priority order)

1. **Brief #5** — Constitution Questionnaire history on doctor's patients page. Ready to run, hasn't shipped yet.
2. **Compliance** — engage Malaysian health-tech lawyer to review `compliance/privacy-policy.md` + `compliance/terms-of-service.md` (drafts ready, lawyer engagement guide at `compliance/lawyer-engagement-brief.md`). Budget RM 1,500–3,500. Use the email template provided.
3. **Pricing decisions** — fill in `[PRICE: TBD]` placeholders in v3/services.html (5 spots: video consult, in-person consult, follow-up consult, herb shop OTC starting from, AI Wellness future pricing).
4. **Practitioner content collection** — photos, bios, lineages, specialties, video intros. Unblocks the practitioner-card placeholders and a future Brief #12 to swap them for real profiles.
5. **v2 → v3 cutover** — once v3 is fully approved and lawyer review done, swap v2 (live) for v3 (preview). Will require: rewriting v3's `../v2/...` cross-page links to v2-relative when v3 becomes the new live, removing preview banners, possibly redirecting old v2 URLs.

## Lower-priority / parking lot

- Patients page hide-toggles for DOB / tongue sections — already shipped (collapsible sections existed before this work)
- Tongue photo storage on Railway — was disappearing, partial fix; needs S3-style object storage migration
- Medicine stock decrement on dispense — needs verification
- Language switching broken on some pages — audit
- Pre-launch hardening — security headers, CORS lockdown, Stripe real webhook, rate limiting, account lockout (all deferred until launch)
- Visual rebrand pass with a real Malaysian designer — Q3 2026 candidate when practitioner content + early revenue exist

## Operating rules mobile-Claude must honour

(These are also in the Custom Instructions of your Project, but reinforcing here.)

- **For coding work:** give the user 2–3 options with pros/cons + your recommendation. Never give one approach without alternatives.
- **For business decisions:** give possible good outcomes AND possible bad outcomes before recommending.
- **Auto-fix vs ask:** for any change you spot, default to BAKING THE FIX INTO THE BRIEF rather than asking. Only escalate when the change is data-model-breaking, affects >10 files, touches security/PII, costs money, needs the user's taste, or is irreversible.
- **v2/v3 patching rule:** Tech/bug fixes auto-patch BOTH v2 and v3. Design/content changes ASK whether to patch v2+v3 or v3 only.
- **v3 sub-page conventions** (the recurring pitfalls — never repeat these mistakes):
  - Universal hero CSS already covers any new v3 sub-page hero — don't add page-specific selectors
  - When a new v3 page ships, update the dropdown link in EVERY existing v3 page (include this as a task in the brief)
  - Every v3 page must include `about-dropdown.js` script
  - `.reveal` is intentionally neutralized — don't add new transitions
  - Never use `padding: 0 max(1.5rem, calc(50% - 540px))` inside a max-width container
  - Use literal `[PRICE: TBD]` / `[DATE: TBD]` placeholders, never invent specific numbers

- **Bilingual everywhere:** every copy block uses `<span lang="en">...</span><span lang="zh">...</span>` pattern. Existing lang-switcher.js handles the toggle.

## What desktop-Cowork has access to that mobile-Claude doesn't

Desktop-Cowork can read/write files in `E:\Hansmed-system` directly, run git, run image conversion, query the codebase. So when the user asks mobile-Claude to "fix X" mobile-Claude can't actually fix X — mobile-Claude can only DRAFT a brief that the user then runs through Claude Code on desktop, OR just discuss / strategize.

For anything that requires file changes, mobile-Claude's job is to:
1. Talk through the problem with the user
2. Draft a clean brief the user can hand to Claude Code (or to desktop-Cowork later)
3. NOT pretend to make the change

For business questions / planning / brainstorming / regulatory thinking — mobile-Claude can fully participate without desktop access.

---

## Default greeting for new mobile chats

"Hey — CEO here. We're mid-redesign — v3 of the public site is shipping page by page (home, about, services, practitioners all now live in preview). Brief #5 is queued; lawyer engagement and pricing decisions are open. What are we tackling? Quick options if you don't know: pick a queued task, plan a new feature, or business/regulatory question."
