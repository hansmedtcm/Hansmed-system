# HansMed Modern TCM — Privacy Policy

**Effective date:** [DATE TO BE INSERTED ON PUBLICATION]
**Last updated:** [DATE]
**Operator:** [LEGAL ENTITY NAME — e.g. "HansMed Modern TCM Sdn Bhd" / "[Founder Name] trading as HansMed Modern TCM"]
**Registered address:** [INSERT]
**Contact for privacy matters:** hansmed.moderntcm@gmail.com

> **Note to lawyer reviewing this draft:** This document is an AI-assisted first draft based on Malaysian PDPA 2010, the Traditional and Complementary Medicine Act 2016 ("T&CM Act"), MMC telemedicine guidance, NPRA (National Pharmaceutical Regulatory Agency) requirements for herbal products, and standard healthcare-platform practice. Sections marked **[REVIEW]** require explicit legal sign-off. Sections marked **[INSERT]** require operator-supplied facts.

---

## 1. Who we are

HansMed Modern TCM ("**HansMed**", "**we**", "**us**", "**our**") operates an online platform that connects users in Malaysia with licensed Traditional Chinese Medicine ("**TCM**") practitioners for video and in-person consultations, AI-assisted wellness assessments, herbal prescriptions, and an online herbal product shop. The platform is operated by [LEGAL ENTITY] under [REGISTRATION NUMBER]. **[INSERT]**

This Privacy Policy explains what personal data we collect about you, why we collect it, how we use and share it, and what rights you have under Malaysia's Personal Data Protection Act 2010 ("**PDPA**") and other applicable laws.

By using HansMed, you agree to the data practices described in this Policy. If you do not agree, please do not use the platform.

## 2. Who this Policy applies to

This Policy applies to:

- Visitors browsing our public website
- Patients (users seeking consultations or buying herbal products)
- Licensed TCM practitioners using HansMed to provide care
- Pharmacy staff fulfilling prescriptions
- Anyone contacting us through our forms, email, or messaging

If you are a practitioner or staff member, additional terms in your engagement agreement may also apply.

## 3. Personal data we collect

We collect the following categories of personal data. Sensitive data (marked **[Sensitive]**) is handled with additional safeguards as described in Section 6.

**3.1 Account and identity data**
- Name (full legal name and preferred name)
- Email address, phone number
- Date of birth, gender
- Identity Card (NRIC) number — collected only when required for medical record verification or regulatory reporting **[Sensitive]**
- Address (for in-person visits and herbal product delivery)
- Account password (stored as a one-way cryptographic hash; we cannot read it)

**3.2 Health and medical data [Sensitive]**
- Chief complaint, present illness, past medical history
- Vital signs entered during consultation (blood pressure, pulse)
- TCM-specific diagnostic data: pulse readings, tongue photographs, body diagram annotations
- Constitution / DOB analysis results, AI Wellness Assessment outputs (these are aides for the practitioner, not medical diagnoses — see Section 8)
- Prescription details (herbs, dosage, duration), treatment notes, pharmacy fulfillment records
- Documents you upload (scanned reports, prescriptions from other providers)

**3.3 Payment data**
- Payment is processed by [Stripe Payments Singapore Pte Ltd] **[INSERT confirmed Stripe entity]**. We do not store full credit card numbers. We store transaction records (date, amount, last four digits, payment status) for accounting and refund purposes.

**3.4 Communication data**
- Messages you send through the platform's chat or contact forms
- Email correspondence with our support team
- Recordings of video consultations are NOT made by HansMed. Practitioners may take written notes during the call; those notes form part of your medical record.

**3.5 Technical and usage data**
- Device type, browser, operating system, IP address
- Pages visited, features used, timestamps
- Cookies and similar identifiers (see Section 12)

**3.6 Data we do NOT collect**
- We do not record video consultations.
- We do not access your camera, microphone, or location outside of an active consultation that you initiate.
- We do not collect children's data; HansMed is not intended for users under 18 (see Section 13).

## 4. How we collect your data

- **Directly from you** — when you register, fill out forms, book a consultation, message a practitioner, or upload documents.
- **Generated during your use of the platform** — for example, AI Wellness assessment outputs are generated from photos or questionnaire answers you submit.
- **From your practitioner** — case records, prescriptions, treatment notes are entered by the licensed practitioner who consults with you. You are entitled to a copy of these records (see Section 9).
- **From third parties** — for example, Stripe sends us payment confirmation; if you sign in via Google SSO, Google provides your name and email. We do not buy or scrape data.

## 5. Why we use your data (purposes and lawful basis under PDPA)

We process your personal data for the following purposes. Under PDPA, our lawful basis for each is one or more of: (a) your **consent**; (b) **performance of a contract** with you (the consultation or sale agreement); (c) **legal obligation** (e.g. regulatory record-keeping); (d) **legitimate interest** (e.g. fraud prevention, platform security).

| Purpose | Examples | Lawful basis |
|---------|----------|--------------|
| Provide consultations | Connect you with a practitioner, hold the video call, record case notes | Contract |
| Issue and fulfill prescriptions | Practitioner writes Rx, pharmacy dispenses herbs, courier delivers | Contract |
| Process payments | Charge consultation/product fees, issue invoices | Contract |
| Maintain medical records | Required by T&CM Act and professional standards | Legal obligation |
| Provide customer support | Respond to your inquiries | Contract / legitimate interest |
| Improve the platform | Aggregated, de-identified analytics on how features are used | Legitimate interest |
| Communications | Service emails (booking confirmations, prescription ready), policy updates | Contract / legitimate interest |
| Marketing | Newsletters, promotions — only if you opt in | Consent |
| Legal compliance | Tax records, anti-fraud, response to lawful authority requests | Legal obligation |

We do **not** use your health data for marketing or share it with advertisers under any circumstances.

## 6. Special handling of sensitive data **[REVIEW]**

Health data, NRIC numbers, and AI assessment outputs are treated as sensitive personal data. We apply the following additional controls:

- **Access control** — only the practitioner you have consulted with, you yourself, and authorized HansMed staff with a need-to-know reason can access your medical records.
- **Encryption** — data in transit between your device and our servers is encrypted using HTTPS/TLS. Data at rest is stored on encrypted databases [REVIEW: confirm with Railway / hosting provider].
- **Audit logging** — staff access to medical records is logged. **[REVIEW: confirm logging is in place and retention period.]**
- **Practitioner-patient confidentiality** — practitioners on HansMed are licensed under the T&CM Act and bound by professional confidentiality obligations.

## 7. Who we share your data with

We share your data only with the following categories of recipients, each only to the extent necessary:

**7.1 Your treating practitioner and pharmacy** — to provide the care you have asked for.

**7.2 Service providers (data processors acting on our instructions)** —
- **Hosting:** Railway (United States) for backend servers and database **[REVIEW: confirm region]**
- **Payments:** Stripe (Singapore) for payment processing
- **Video calling:** Daily.co or Jitsi or Google Meet (depending on practitioner choice) **[REVIEW: confirm which provider is contracted]**
- **AI assessment:** Anthropic Inc. (United States) for Claude API used in tongue analysis. Anthropic does not retain submitted images for training and processes them solely to return the analysis result. **[REVIEW: confirm with Anthropic enterprise contract]**
- **Email:** [TRANSACTIONAL EMAIL PROVIDER — INSERT, e.g. SendGrid / Postmark]
- **Analytics:** [INSERT — Google Analytics / Plausible / none]

We require service providers to keep your data confidential and use it only for the services we have engaged them for.

**7.3 Legal and regulatory recipients** — we may disclose data to law enforcement, regulators (e.g. Ministry of Health, T&CM Council), or courts when required by Malaysian law.

**7.4 Business transfer** — if HansMed is sold, merged, or restructured, your data may transfer to the successor entity, which will remain bound by this Policy or a comparable one. You will be notified.

**7.5 With your consent** — for any other sharing not listed above, we will ask you first.

We do not sell your personal data.

## 8. Important: AI Wellness Assessment is not a medical diagnosis **[REVIEW]**

The AI Wellness Assessment, tongue analysis, and DOB constitution analysis tools on HansMed produce results that are **clinical aides for licensed practitioners**, not standalone medical diagnoses. AI outputs are **always reviewed by a licensed TCM practitioner** before they are presented as part of your care.

You should not rely on AI outputs alone for any health decision. If you experience a medical emergency, contact emergency services (999 in Malaysia) or proceed to the nearest hospital. **[REVIEW]**

## 9. Your rights under PDPA

You have the following rights regarding your personal data. To exercise any of them, email hansmed.moderntcm@gmail.com with the subject line "PDPA Request".

- **Right to access** — request a copy of the personal data we hold about you.
- **Right to correct** — ask us to correct inaccurate data.
- **Right to withdraw consent** — withdraw any consent you have given (this may limit our ability to provide services).
- **Right to limit processing** — ask us to stop using your data for marketing or for purposes we cannot establish are necessary.
- **Right to be informed** — receive details about how your data is processed (this Policy).
- **Right to data portability** — receive your medical records in a portable format.

We will respond within twenty-one (21) calendar days as required by PDPA. We may charge a reasonable fee for access requests as permitted by PDPA. **[REVIEW]**

If you are dissatisfied with our response, you may complain to the Personal Data Protection Commissioner of Malaysia (https://www.pdp.gov.my).

## 10. Data retention

We retain personal data for the following periods. After the retention period ends, data is deleted or anonymized.

| Data category | Retention period | Reason |
|---------------|------------------|--------|
| Account profile | Active account + 2 years after closure | Re-activation, audit |
| Medical records | At least 7 years after last consultation **[REVIEW: confirm with T&CM Council standards]** | Professional obligation, legal claims |
| Prescriptions | At least 7 years **[REVIEW]** | Pharmaceutical regulatory record |
| Payment / invoice records | 7 years | Tax law (Income Tax Act 1967 record-keeping requirement) |
| Marketing consent records | Until withdrawn + 2 years | Audit |
| Server access logs | 90 days | Security investigation |
| Backup copies | Up to 30 days after deletion from production | Disaster recovery |

## 11. International data transfers

Some of our service providers (Anthropic, Stripe, Railway) process data in the United States or Singapore. Where we transfer your data outside Malaysia, we rely on:

- The recipient's compliance with comparable data protection standards
- Contractual safeguards (data processing agreements / standard contractual clauses)
- Your explicit consent where required

By using the platform, you acknowledge that some of your data may be processed outside Malaysia. **[REVIEW: PDPA requires explicit consent for transfers to certain jurisdictions; confirm whether US transfers require additional consent.]**

## 12. Cookies and similar technologies

HansMed uses the following types of cookies:

- **Essential** — required for the site to function (login session, language preference). These cannot be disabled.
- **Analytics** — help us understand how the site is used. **[INSERT — list each analytics tool, or confirm none used]**
- **Marketing** — only set if you opt in.

You can control cookies through your browser settings.

## 13. Children's privacy

HansMed is intended for users aged 18 and over. We do not knowingly collect data from anyone under 18. Patients under 18 may be treated with parental/guardian consent and supervision through a parent's account; in that case, the parent is responsible for managing the child's data.

If you believe we have collected data from a child without consent, contact us and we will delete it.

## 14. How we keep your data secure

We use technical and organizational measures including:

- HTTPS/TLS encryption for all data in transit
- Encrypted database storage at our hosting provider **[REVIEW]**
- Role-based access control (only the right roles can see medical data)
- Audit logging of staff access **[REVIEW]**
- Secure software development practices and routine vulnerability checks
- Defined response procedures for security incidents

No system is completely secure. If we discover a personal data breach affecting your data, we will notify you and the Personal Data Protection Commissioner as required by law and best practice. **[REVIEW: PDPA does not currently mandate breach notification, but sectoral guidance and best practice support it. Confirm with lawyer.]**

## 15. Changes to this Policy

We may update this Policy as the platform evolves. The "Last updated" date at the top will reflect the most recent change. For material changes, we will notify you by email or through a prominent notice on the platform. Your continued use of HansMed after a change indicates acceptance of the updated Policy.

## 16. Contact us

For any privacy question, request, or complaint:

**Email:** hansmed.moderntcm@gmail.com
**Subject line:** "PDPA Request" or "Privacy Inquiry"
**Response time:** Within 21 calendar days

Address: [INSERT]

---

*Drafted with AI assistance. Reviewed by [LAWYER NAME / LAW FIRM] on [DATE]. Next review due [DATE].*
