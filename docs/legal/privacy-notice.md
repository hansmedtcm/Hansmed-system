# HansMed Privacy Notice

**Version:** 1.0
**Effective date:** [TO BE SET AT LAUNCH]
**Last reviewed:** 2026-04-21
**Applies to:** HansMed web platform and all related services

> **Note to counsel:** This notice is drafted to satisfy Malaysia's Personal Data Protection Act 2010 (PDPA), the PDPA Standards 2015, and good practice aligned with GDPR Article 13/14 where the platform is accessed from the EU. Engage Malaysian privacy counsel before publishing.

---

## 1. Who we are

HansMed ("we", "us", "our") is a wellness technology platform operated by [REGISTERED ENTITY NAME], a company incorporated in Malaysia (Company No. [XXXX]). Our registered address is [ADDRESS].

For privacy matters, contact our Data Protection Officer:
- Email: privacy@hansmed.my
- Post: [DPO ADDRESS]
- Phone: [DPO PHONE]

## 2. Summary (plain English)

If you want the short version:
- We collect what we need to run the platform and nothing more
- We do not sell your data
- AI analyses your tongue photos and questionnaire answers to produce wellness insights (not medical diagnoses)
- Licensed TCM practitioners can see your data only if you book a consultation with them
- You can export or delete your data anytime
- We keep data in Malaysia where possible; some AI processing may involve servers outside Malaysia (disclosed below)

The full notice follows.

## 3. What data we collect

**Account data:** name, email, phone, password (hashed), date of birth, gender, preferred language.

**Health data (sensitive personal data under PDPA § 4):**
- Tongue photographs
- Questionnaire answers (symptoms, habits, history)
- Practitioner consultation notes and recommendations
- Prescription / supplement records issued by practitioners on the platform
- Appointment history

**Commerce data:** delivery address, order history, (simulated) payment tokens.

**Technical data:** IP address, device type, browser, pages visited, timestamps. Captured via essential cookies and, with your consent, analytics cookies.

**Practitioner data (for practitioners):** T&CM Council registration, practice address, qualifications, bank details for settlement.

## 4. Why we collect it, and our legal basis

| Purpose | Data used | Legal basis (PDPA) |
|---|---|---|
| Create and run your account | Account data | Contract (§ 6(1)(b)) |
| Produce wellness insights | Health data | Explicit consent (§ 40) |
| Connect you to a practitioner | Health data + account | Explicit consent (§ 40) per booking |
| Fulfill orders | Commerce data | Contract |
| Comply with law (tax, T&CM audits) | All relevant | Legal obligation (§ 6(1)(c)) |
| Improve the service | Anonymized analytics | Consent (opt-in) |
| Marketing | Email, preferences | Consent (opt-in, revocable) |

## 5. AI processing disclosure

Your tongue images and questionnaire answers may be processed by third-party AI models hosted by:

- [AI VENDOR 1] — image analysis — data processed in [COUNTRY]
- [AI VENDOR 2] — text analysis — data processed in [COUNTRY]

**What the AI does:** classifies visual and textual patterns and returns educational wellness insights (e.g. "your tongue shows patterns commonly associated with warmth / dampness in TCM theory").

**What the AI does not do:** diagnose disease, prescribe medicine, or make clinical decisions. No output from AI is a medical opinion.

**Retention with AI vendors:** we configure vendors to zero-retention where possible. Where the vendor retains data for abuse monitoring, we disclose the maximum retention here: [X days].

## 6. How long we keep data

| Data category | Retention |
|---|---|
| Tongue images | 90 days after upload (or until you delete, whichever is earlier) |
| Questionnaire answers | Until account deletion + 30 days |
| Consultation records | 7 years after last consultation (T&CM / medical record best practice) |
| Commerce / tax records | 7 years (Income Tax Act 1967 § 82) |
| Account data | Until account deletion |
| Marketing preferences | Until revoked + 30 days audit |
| Server logs | 90 days |

If you delete your account, we remove identifying data within 30 days except where law requires retention (above).

## 7. Who we share data with

- **Practitioners you book:** only the specific records you consent to share at booking time
- **Infrastructure providers:** hosting (e.g. AWS), email, SMS, (eventual) payment processor — bound by data processing agreements
- **AI vendors:** as disclosed in § 5
- **Government authorities:** only when legally compelled (court order, tax audit, MOH inspection)

We do not sell data. We do not share with advertisers.

## 8. Cross-border transfer

Where data leaves Malaysia (e.g. AI vendors hosted in Singapore or the US), we rely on:
- Your explicit consent (PDPA § 129)
- Contractual safeguards requiring the recipient to apply PDPA-equivalent standards
- Vendor certifications (e.g. SOC 2, ISO 27001) where available

Current transfer destinations: [LIST COUNTRIES]

## 9. Your rights under PDPA

You have the right to:

- **Access** your data (PDPA § 30) — request at privacy@hansmed.my or via Account → Privacy → Export
- **Correct** inaccurate data (§ 34) — edit in Account Settings, or request
- **Prevent processing** that causes damage or distress (§ 42)
- **Prevent direct marketing** (§ 43) — one-click unsubscribe in any marketing email
- **Withdraw consent** (§ 38) — Account → Privacy → Revoke
- **Lodge a complaint** with the Personal Data Protection Commissioner if you believe we have mishandled your data

We respond to data subject requests within 21 days (PDPA target).

## 10. Security measures

- Encryption at rest (AES-256) and in transit (TLS 1.2+)
- Role-based access control; practitioner access scoped to their patients
- Staff access logged and reviewed
- Penetration tests conducted [ANNUALLY / BEFORE LAUNCH]
- Incident response plan with 72-hour notification to affected users and, where applicable, the Commissioner

No system is perfectly secure. If we detect a breach affecting you, we will notify you promptly.

## 11. Cookies

**Essential cookies** (no consent needed): session, CSRF token, language preference.
**Analytics cookies** (opt-in): [VENDOR], used to understand usage patterns.
**Marketing cookies:** none by default.

Manage cookies via the banner or Account → Privacy → Cookies.

## 12. Children

HansMed is not directed at children under 18. Users under 18 may use the platform only with parental or guardian consent, and the parent/guardian is the PDPA data subject for records purposes. Do not upload a child's tongue photo without guardian consent.

## 13. Changes to this notice

We may update this notice. Material changes trigger:
- A banner at next login
- An in-app re-consent modal (see Consent Copy doc M5)
- An email to your registered address

Archived versions are available on request.

## 14. How to contact us about privacy

- **Routine requests:** Account → Privacy (self-service)
- **Data access / export / deletion:** privacy@hansmed.my
- **Complaints:** dpo@hansmed.my, response within 5 working days
- **Regulator:** Pejabat Pesuruhjaya Perlindungan Data Peribadi, Malaysia — https://www.pdp.gov.my

---

## Appendix A — Glossary

- **PDPA:** Personal Data Protection Act 2010 (Malaysia)
- **Sensitive personal data:** information about physical/mental health, religious beliefs, political opinions, etc. (PDPA § 4)
- **Data user:** the entity determining purpose and manner of processing (HansMed, in most cases)
- **Data processor:** an entity processing data on behalf of the data user (e.g. our AI vendors)
- **T&CM:** Traditional and Complementary Medicine

## Appendix B — For practitioners

If you are a practitioner providing services on HansMed, a separate **Practitioner Data Processing Agreement** governs your handling of patient data. You are a co-controller/co-data-user for records you create. See Onboarding SOP.

---

**PLACEHOLDERS TO FILL BEFORE PUBLISHING:**
- [REGISTERED ENTITY NAME], Company No., address
- DPO contact details
- Specific AI vendor names, countries, retention windows
- Cross-border transfer country list
- Cookie vendor names
- Penetration test cadence
