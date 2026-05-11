# HansMed — Engaging a Malaysian Health-Tech Lawyer

A short guide for finding and briefing the right lawyer to review the Privacy Policy and Terms of Service drafts.

## What you're hiring for

A **review** (not a full draft from scratch). The drafts in `compliance/privacy-policy.md` and `compliance/terms-of-service.md` are AI-prepared first drafts that cover the structure, common Malaysian PDPA points, and standard health-tech disclaimers. The lawyer's job is to verify, correct, and bless them — not to start from a blank page.

This is a shorter, cheaper engagement than a full custom draft. Be explicit about the scope when asking for a quote.

## What kind of lawyer to look for

You want one of these profiles:

1. **Health-tech / digital health specialist** at a Malaysian firm. Best fit. Will know PDPA, T&CM Act, MMC telemedicine guidance, NPRA requirements all together. Examples of firms with health-tech practices: SKRINE, Christopher & Lee Ong, Zaid Ibrahim & Co, Wong & Partners. **[Don't take this list as endorsement — call and ask which partner handles digital health, then check fit.]**
2. **PDPA/data privacy lawyer with healthcare clients.** Second best. Will catch PDPA issues even if less familiar with TCM specifics.
3. **Generalist commercial lawyer with healthcare clients.** OK if budget is tight. Brief them well using the "review request" template below.

Avoid: pure litigation lawyers, pure conveyancing lawyers, family lawyers. They'll either decline or give you weak advice.

## Budget expectation

For a focused review of two ~3,000-word documents (privacy policy + ToS) by a Malaysian lawyer with health-tech experience:

- **Mid-range estimate:** RM 1,500 to RM 3,500 for a single round of review with markup and a 30-minute call.
- **Lower end** (smaller firm or generalist): RM 800 to RM 1,500.
- **Higher end** (top-tier firm partner, urgent turnaround): RM 5,000+.

Always ask for a fixed fee for the scope. Avoid hourly billing on this kind of bounded work.

## How to find one

- Personal network — ask any startup founder or doctor friend for a referral. Best path.
- Malaysian Bar website (https://www.malaysianbar.org.my) → search by practice area.
- LinkedIn — search "Privacy Lawyer Malaysia" and check who has health-tech clients in their work history.
- Specialist newsletters and conferences — anyone who's spoken on PDPA + healthcare in the past 2 years is a strong signal.

## Email template to send to a candidate lawyer

Subject: **TCM telehealth platform — Privacy Policy + ToS review (~RM 2,000 fixed-fee scope)**

> Hello [Name],
>
> I'm the founder of HansMed Modern TCM, a Malaysian online platform that connects patients with licensed TCM practitioners for video and in-person consultations, AI-assisted clinical aides, and herbal prescriptions / NPRA-registered herbal product sales.
>
> I have AI-prepared draft Privacy Policy and Terms of Service documents (~3,000 words each) that cover PDPA, T&CM Act 2016, MMC telemedicine guidance, NPRA, Stripe/SST, and standard health-tech disclaimers. I'm looking for a fixed-fee review and markup, plus a 30-minute call to discuss your edits, before I publish them on hansmedtcm.github.io.
>
> Specific areas I'd value your attention on:
>
> 1. PDPA consent mechanics, especially for AI processing of tongue images via Anthropic's Claude API (US).
> 2. Liability disclaimers for AI Wellness assessments (clearly positioned as practitioner-aides, not diagnoses).
> 3. T&CM Act compliance for an online platform that's NOT itself a TCM practice but enables one.
> 4. Refund / return rules for dispensed herbal medicines (no return) vs OTC products.
> 5. NPRA compliance for OTC herbal product listings.
> 6. Cross-border data transfer (Stripe SG, Railway US, Anthropic US).
> 7. Whether breach notification practice is recommended despite PDPA not currently mandating it.
>
> Could you share a fixed-fee quote and turnaround estimate? Drafts are attached.
>
> Best,
> [YOUR NAME]
> HansMed Modern TCM
> hansmed.moderntcm@gmail.com

## After the lawyer returns the marked-up drafts

1. Apply their edits to `compliance/privacy-policy.md` and `compliance/terms-of-service.md` (or have me do it).
2. Set the **Effective date** and **Last updated** date in both files (same date).
3. Convert each to clean HTML and publish at:
   - `hansmedtcm.github.io/Hansmed-system/v2/privacy.html`
   - `hansmedtcm.github.io/Hansmed-system/v2/terms.html`
4. Add footer links to both pages in your site nav and the registration form.
5. Add a checkbox at registration: "I have read and accept the [Terms of Service] and [Privacy Policy]" (required).
6. Keep the marked-up version from the lawyer in `compliance/archive/` as evidence the review happened.

## When to re-review

- Whenever you add a major new feature that processes data differently (e.g. wearable integration, new AI service, telehealth into a new country).
- Whenever the law changes (PDPA amendments, MMC updates, new sectoral rules).
- At least every 18 months even if nothing changes — privacy law moves fast.

---

*Last updated: [DATE]*
