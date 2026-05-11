/**
 * Build the PDPA Compliance Package draft for HansMed Modern TCM.
 * Output: PDPA-Compliance-Package-DRAFT.docx — for lawyer review.
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  HeadingLevel, PageBreak, PageNumber, LevelFormat,
} = require('/tmp/node_modules/docx');

const ARIAL = 'Arial';

const HSTYLE = (size, bold = true) => ({ font: ARIAL, size, bold });
const BSTYLE = { font: ARIAL, size: 22 };  // 11pt body
const SMALLSTYLE = { font: ARIAL, size: 18, italics: true };

// --- Helpers ---
const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ ...BSTYLE, text, ...opts })],
  spacing: { after: 120 },
});
const pBold = (text) => new Paragraph({
  children: [new TextRun({ ...BSTYLE, text, bold: true })],
  spacing: { after: 80 },
});
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ ...HSTYLE(32) , text })],
  spacing: { before: 320, after: 160 },
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ ...HSTYLE(26) , text })],
  spacing: { before: 240, after: 120 },
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ ...HSTYLE(22), text })],
  spacing: { before: 160, after: 80 },
});
const note = (text) => new Paragraph({
  children: [new TextRun({ ...SMALLSTYLE, text })],
  spacing: { after: 120 },
});
const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  children: [new TextRun({ ...BSTYLE, text })],
  spacing: { after: 60 },
});
const numbered = (text) => new Paragraph({
  numbering: { reference: 'numbers', level: 0 },
  children: [new TextRun({ ...BSTYLE, text })],
  spacing: { after: 60 },
});
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// --- Tables ---
const border = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargin = { top: 80, bottom: 80, left: 120, right: 120 };

function tableCell(text, opts = {}) {
  return new TableCell({
    borders,
    width: { size: opts.width || 2340, type: WidthType.DXA },
    shading: opts.head ? { fill: 'E8E0D0', type: ShadingType.CLEAR } : undefined,
    margins: cellMargin,
    children: [new Paragraph({
      children: [new TextRun({
        font: ARIAL, size: 20, bold: !!opts.head, text: String(text),
      })],
    })],
  });
}

function tableRow(cells, widths, head = false) {
  return new TableRow({
    children: cells.map((c, i) => tableCell(c, { width: widths[i], head })),
    tableHeader: head,
  });
}

function makeTable(headers, rows, widths) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      tableRow(headers, widths, true),
      ...rows.map(r => tableRow(r, widths)),
    ],
  });
}

// --- Document ---
const doc = new Document({
  creator: 'HansMed Modern TCM',
  title: 'PDPA Compliance Package — Draft for Legal Review',
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  styles: {
    default: { document: { run: { font: ARIAL, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: ARIAL },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: ARIAL },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: ARIAL, italics: true },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },  // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ font: ARIAL, size: 18, color: '888888', text: 'HansMed Modern TCM — PDPA Compliance Package — DRAFT' })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ font: ARIAL, size: 18, color: '888888', text: 'Page ' }),
          new TextRun({ font: ARIAL, size: 18, color: '888888', children: [PageNumber.CURRENT] }),
        ],
      })] }),
    },
    children: [
      // === COVER PAGE ===
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 240 },
        children: [new TextRun({ font: ARIAL, size: 48, bold: true, text: 'HansMed Modern TCM' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ font: ARIAL, size: 36, text: '漢方現代中醫' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800, after: 200 },
        children: [new TextRun({ font: ARIAL, size: 32, bold: true, text: 'PDPA Compliance Package' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ font: ARIAL, size: 28, italics: true, text: 'DRAFT — for Legal Review' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1600, after: 80 },
        children: [new TextRun({ font: ARIAL, size: 22, text: 'Prepared: 9 May 2026' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ font: ARIAL, size: 22, text: 'Jurisdiction: Malaysia' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ font: ARIAL, size: 22, text: 'Contact: hansmed.moderntcm@gmail.com  |  support@hansmedtcm.com' })],
      }),
      pageBreak(),

      // === DISCLAIMER ===
      h1('Disclaimer'),
      p('This document is a working draft prepared by the HansMed founding team to support legal review. It is NOT legal advice. The drafted text and recommendations herein are best-effort interpretations of Malaysia’s Personal Data Protection Act 2010 (and the 2024 amendments where flagged), Traditional and Complementary Medicine Act 2016, and adjacent regulatory guidance, but they have not been verified by legal counsel.'),
      p('This package is intended to give the reviewing lawyer:'),
      bullet('A factual inventory of the data we collect, where it lives, and who processes it.'),
      bullet('Draft public-facing artefacts (Privacy Policy, Terms of Service, Personal Data Protection Notice) for redlining.'),
      bullet('Draft consent texts to be embedded in the registration UI.'),
      bullet('A list of decision points where lawyer judgment is specifically required, before launch.'),
      p('All text in this document is provisional. Final wording, applicability, and compliance posture must be set by counsel.'),

      // === TABLE OF CONTENTS (manual) ===
      h1('Contents'),
      bullet('1. Executive Summary'),
      bullet('2. Decision Points for Counsel'),
      bullet('3. Business Overview'),
      bullet('4. Personal Data Inventory'),
      bullet('5. Third-Party Processors and Vendor List'),
      bullet('6. Cross-Border Data Transfers'),
      bullet('7. Draft Privacy Policy'),
      bullet('8. Draft Terms of Service'),
      bullet('9. Consent Mechanisms (UI texts)'),
      bullet('10. Data Subject Rights — Procedures'),
      bullet('11. Data Breach Response Plan'),
      bullet('12. Data Retention Schedule'),
      bullet('13. Personal Data Protection Notice (PDPN) — Trilingual Drafts'),
      bullet('14. Malaysia-Specific Compliance Items'),
      bullet('15. Payment Processor Disclosure (iPay88)'),
      bullet('16. References'),
      pageBreak(),

      // === 1. EXECUTIVE SUMMARY ===
      h1('1. Executive Summary'),
      p('HansMed Modern TCM is a telehealth platform that connects patients in Malaysia with licensed Traditional Chinese Medicine practitioners. The platform offers AI-assisted wellness assessment (tongue image analysis and constitution questionnaires), online consultations, prescription issuance, and herbal medicine fulfilment.'),
      p('The platform is currently in soft-launch phase, serving only internal testers. No customer-facing launch will occur until this PDPA Compliance Package has been reviewed and approved by counsel.'),
      pBold('Why this review is critical:'),
      bullet('We process sensitive personal data within the meaning of PDPA 2010 §3(1) and §40 (physical and mental health information).'),
      bullet('We use AI services hosted outside Malaysia (Anthropic, United States) for tongue and constitution analysis, triggering the cross-border transfer regime under PDPA 2010 §129.'),
      bullet('We are subject to the Traditional and Complementary Medicine Act 2016 record-keeping requirements (data retention overlap with PDPA right of erasure).'),
      bullet('Data Protection (Amendment) Act 2024 introduces mandatory breach notification, Data Protection Officer designation thresholds, and right of data portability — currency of those amendments must be confirmed.'),
      bullet('We integrate with payment processor iPay88 (Malaysian provider) and store no card-on-file data ourselves.'),
      pageBreak(),

      // === 2. DECISION POINTS ===
      h1('2. Decision Points for Counsel'),
      p('Items requiring counsel’s explicit guidance before public launch. Where a draft answer or working assumption is given, please confirm or revise.'),

      h3('Q1. Registration with the PDPA Commissioner'),
      p('We process sensitive personal data (health) for users in Malaysia. Our working assumption: registration with the Department of Personal Data Protection (JPDP) is REQUIRED for telehealth providers. Please confirm and advise on timing relative to soft-launch.'),

      h3('Q2. Data Protection Officer (DPO) Designation'),
      p('PDPA Amendment 2024 introduces DPO designation thresholds. Please advise on whether HansMed in soft-launch volume meets the DPO threshold and, if so, what the qualifications and notification requirements are.'),

      h3('Q3. AI Processing Consent'),
      p('Currently the registration form captures: (a) general PDPA consent; and (b) acknowledgment that AI tools are not medical diagnoses. Working assumption: this combined consent is sufficient. Please confirm or advise whether explicit, granular consent for AI inference is required by PDPA §40 (sensitive data, explicit consent).'),

      h3('Q4. Cross-Border Transfer Disclosure'),
      p('Tongue images and constitution questionnaires are sent to Anthropic (US) for AI inference. Anthropic does not retain customer data for model training by default (per Anthropic Commercial Terms). Working assumption: a cross-border transfer disclosure in the Privacy Policy plus the consent at registration suffices under PDPA §129. Please confirm and revise the disclosure language in Section 7.'),

      h3('Q5. Data Retention vs Right of Erasure'),
      p('Two regimes conflict: (i) PDPA grants users a right of erasure / deletion request; (ii) T&CM Act 2016 requires medical records to be retained, typically for 7 years per Malaysian medical norm. Working assumption: when an erasure request is received, identifying data is anonymised but clinical record is retained for the legally mandated period. Please confirm correct posture and the precise retention period.'),

      h3('Q6. Minor Patients'),
      p('We do not currently restrict signup by age. Working assumption: parental consent required for users under 18 per PDPA principles. Please advise on consent mechanism (e.g., guardian co-signature, ID verification) and any age below which we should refuse service.'),

      h3('Q7. Data Breach Notification Window'),
      p('PDPA Amendment 2024 introduces mandatory breach notification. Working assumption: 72-hour notification to JPDP and affected users when breach risks individuals’ rights. Please confirm precise timeframes and notification format.'),

      h3('Q8. Trilingual Personal Data Protection Notice'),
      p('PDPA 2010 §7 requires the Notice in English and Bahasa Malaysia. Mandarin Chinese is offered for accessibility but is not legally required. Please confirm sufficiency and review the Bahasa text in Section 13 for accuracy and legal-register suitability.'),

      h3('Q9. Doctor / Practitioner Data'),
      p('Doctors uploaded to the platform are licensed TCM practitioners under T&CM Act 2016. Their professional credentials (license number, years of practice) are surfaced on patient-facing pages. Working assumption: this is publicly disclosable professional data, not subject to the same restrictions as patient health data. Please confirm.'),

      h3('Q10. T&CM Act 2016 Specific Obligations'),
      p('Beyond record-keeping, we believe T&CM Act 2016 obliges practitioners (not the platform itself) to maintain records and registration. Please advise whether HansMed-as-platform has additional T&CM-specific obligations beyond facilitating practitioner compliance.'),

      pageBreak(),

      // === 3. BUSINESS OVERVIEW ===
      h1('3. Business Overview'),
      h3('3.1 Entity'),
      p('HansMed Modern TCM (working name; legal entity to be confirmed). Operating jurisdiction: Malaysia.'),
      h3('3.2 User Categories'),
      bullet('Patients — self-register via the public website. Provide name, email, phone, password, optional health data.'),
      bullet('Practitioners (Doctors) — onboarded by HansMed admins. Provide credentials and bank/payout information.'),
      bullet('Pharmacies — partner B2B entities, onboarded by HansMed admins.'),
      bullet('Internal administrators — HansMed staff with elevated permissions.'),
      h3('3.3 Service Offerings (Sensitive-Data Touchpoints)'),
      bullet('AI-assisted tongue diagnosis (image upload + AI analysis + practitioner review).'),
      bullet('AI constitution questionnaire (text input + AI analysis + practitioner review).'),
      bullet('Online video / messaging consultations with practitioners.'),
      bullet('Prescription issuance and herbal medicine fulfilment.'),
      bullet('Patient profile and clinical history.'),
      h3('3.4 Operational Model'),
      p('All AI outputs are decision-support only. A licensed TCM practitioner reviews and signs off on every prescription before fulfilment. The platform never issues prescriptions autonomously.'),
      pageBreak(),

      // === 4. PERSONAL DATA INVENTORY ===
      h1('4. Personal Data Inventory'),
      p('Mapping of what we collect, why, where it is stored, and the proposed retention period. “Sensitive” marks data within PDPA 2010 §40 (sensitive personal data).'),
      makeTable(
        ['Touchpoint', 'Data collected', 'Purpose', 'Storage', 'Retention'],
        [
          ['Account registration', 'Name (nickname), email, phone, password (hashed), role', 'Account creation; authentication; communication', 'Railway MySQL (Singapore)', 'Until deletion + 7 years audit (TBC)'],
          ['Email verification', '6-digit code (hashed), email', 'Identity proof', 'Railway MySQL (Singapore)', '15 minutes (auto-expiry)'],
          ['Password reset', 'Email, 6-digit code (hashed)', 'Account recovery', 'Railway MySQL (Singapore)', '15 minutes (auto-expiry)'],
          ['Patient profile', 'Date of birth, gender, address, weight, height, allergies, conditions (sensitive)', 'Clinical context for practitioners', 'Railway MySQL (Singapore)', '7 years per medical record norm (TBC)'],
          ['Tongue image (sensitive)', 'JPEG image of tongue, AI inference output', 'AI-assisted diagnosis', 'Cloudflare R2 (APAC) for image; Railway MySQL (Singapore) for analysis text', '7 years; image bytes purged 7 days after deletion request'],
          ['Constitution questionnaire (sensitive)', 'Symptom answers, lifestyle, diet', 'AI constitution scoring', 'Railway MySQL (Singapore)', '7 years (TBC)'],
          ['Consultation transcript', 'Free-text doctor notes; chat messages', 'Clinical record', 'Railway MySQL (Singapore)', '7 years (TBC)'],
          ['Video consultation', 'Video stream (live, not stored); appointment metadata', 'Real-time consultation', 'Stream not persisted', 'Metadata only, 7 years'],
          ['Prescription', 'Diagnosis text, prescribed herbs, dose, doctor signature', 'Medical record + dispensing instruction', 'Railway MySQL (Singapore)', '7 years (TBC)'],
          ['Payment metadata', 'Order ID, amount, status; NO card numbers', 'Reconciliation', 'Railway MySQL (Singapore)', '7 years (tax/audit)'],
          ['Audit log', 'Action, user, IP, user-agent, timestamp', 'Security and compliance', 'Railway MySQL (Singapore)', '2 years (TBC)'],
          ['Login telemetry', 'IP address, user-agent on each login', 'Fraud detection', 'Cache + audit log', 'Cache 15 min; audit 2 years'],
        ],
        [1900, 2100, 1900, 1700, 1426]  // sums to 9026 (A4 content width)
      ),
      pageBreak(),

      // === 5. THIRD-PARTY PROCESSORS ===
      h1('5. Third-Party Processors and Vendor List'),
      p('Per PDPA 2010 §10 (Disclosure Principle), we list each third-party data processor we use, the purpose, the region, and the contractual posture.'),
      makeTable(
        ['Processor', 'Role', 'Region', 'Data shared', 'Contractual basis'],
        [
          ['Cloudflare', 'CDN, DNS, Email Routing, R2 image storage', 'Global edge; R2 in APAC region', 'Tongue images, inbound email forwarding', 'Cloudflare standard ToS + DPA'],
          ['Railway', 'Application hosting (backend + DB)', 'Singapore (asia-southeast1)', 'All structured data (DB)', 'Railway standard ToS + DPA'],
          ['Anthropic', 'AI inference (Claude API)', 'United States', 'Tongue image bytes; constitution text. NOT retained for training (per Commercial Terms).', 'Anthropic Commercial Terms'],
          ['Resend', 'Transactional email (verification codes, password reset)', 'Tokyo (ap-northeast-1)', 'Recipient email, 6-digit code, message text', 'Resend standard ToS + DPA'],
          ['Google (OAuth)', 'Optional sign-in via Google account', 'United States', 'Email, name, avatar URL (only if user opts in to Google sign-in)', 'Google API ToS'],
          ['iPay88', 'Payment processing for consultation fees and shop orders', 'Malaysia', 'Order ID, amount; payment is on iPay88 hosted page (no card data in our systems)', 'iPay88 Merchant Agreement'],
          ['GitHub Pages', 'Static frontend hosting (marketing pages)', 'Global edge', 'Public assets only — no personal data', 'GitHub standard ToS'],
        ],
        [1700, 1700, 1700, 2300, 1626]
      ),
      pageBreak(),

      // === 6. CROSS-BORDER ===
      h1('6. Cross-Border Data Transfers'),
      h3('6.1 Applicable Law'),
      p('PDPA 2010 §129 restricts the transfer of personal data outside Malaysia unless the destination country provides equivalent protection or one of the listed exceptions applies (e.g., consent, contract performance, public interest).'),
      h3('6.2 Transfers Made by HansMed'),
      bullet('Railway (Singapore, asia-southeast1) — application database and backend hosting. Singapore is a recognised data-protection jurisdiction (PDPA Singapore 2012 / 2020 amendment). Working basis: necessary for service operation.'),
      bullet('Cloudflare R2 (APAC region) — tongue image storage. Cloudflare R2 APAC region pools storage across Asia-Pacific data centres (typically Singapore / Tokyo / Hong Kong). Counsel to confirm whether a more specific jurisdictional disclosure is required.'),
      bullet('Anthropic (United States) — tongue images and constitution questionnaire text are sent to Claude API for AI inference. Anthropic Commercial Terms specify customer data is NOT used for model training by default. Working basis: explicit user consent at registration; transfer is necessary for the requested service.'),
      bullet('Resend (Japan, ap-northeast-1) — transactional email content (verification + reset codes) is processed for delivery. Working basis: necessary for service performance.'),
      bullet('Google (United States) — only when a user elects Google OAuth sign-in. Working basis: user-initiated.'),
      h3('6.3 Mitigations'),
      bullet('Anthropic Commercial Terms specify customer data is NOT used for model training by default.'),
      bullet('All transfers occur over TLS 1.2+.'),
      bullet('At-rest encryption is provided by Cloudflare R2 (AES-256) and Railway-managed MySQL (provider default).'),
      bullet('Vendor DPAs are in place or will be procured before launch (counsel to advise on specific DPA wording requirements).'),
      h3('6.4 Counsel guidance requested'),
      p('Confirm that the consent + necessity-of-service justifications are sufficient under PDPA §129, and review the transfer disclosure paragraph in the draft Privacy Policy (Section 7.6).'),
      pageBreak(),

      // === 7. PRIVACY POLICY ===
      h1('7. Draft Privacy Policy'),
      note('Suggested public URL: https://hansmedtcm.com/v2/privacy-policy.html. Final wording to be set by counsel.'),
      h3('7.1 Who we are'),
      p('HansMed Modern TCM (“HansMed”, “we”, “us”) is a Malaysia-based telehealth platform connecting patients with licensed Traditional Chinese Medicine practitioners. This Privacy Policy explains what personal data we collect, why we collect it, how we store it, and your rights under Malaysia’s Personal Data Protection Act 2010 (PDPA).'),
      h3('7.2 Personal data we collect'),
      bullet('Identity and contact: name, email address, phone number, encrypted password.'),
      bullet('Health data (sensitive personal data per PDPA §40): symptoms, conditions, allergies, tongue images, constitution questionnaire responses, consultation notes, prescription history.'),
      bullet('Profile preferences: language, communication preferences.'),
      bullet('Usage and device data: IP address, browser type, login timestamps.'),
      bullet('Payment metadata: order amounts and status. We do NOT store credit card numbers — those are handled by our payment processor (see Section 5).'),
      h3('7.3 Why we collect it'),
      bullet('To create and maintain your account.'),
      bullet('To provide AI-assisted wellness assessment, reviewed by a licensed practitioner.'),
      bullet('To facilitate online consultations and prescription issuance.'),
      bullet('To process payments and deliver herbal medicine.'),
      bullet('To communicate appointment reminders, account notifications, and customer-support replies.'),
      bullet('To meet our legal record-keeping obligations under the Traditional and Complementary Medicine Act 2016.'),
      h3('7.4 Legal basis'),
      p('We rely on your explicit consent (PDPA §8, §40). Consent is captured at registration and at additional touchpoints (e.g., consenting to a video consultation).'),
      h3('7.5 Who we share it with'),
      p('We share your personal data only with:'),
      bullet('Licensed TCM practitioners on the platform, for the purpose of treating you.'),
      bullet('Pharmacies fulfilling your prescription.'),
      bullet('Third-party processors listed in Section 5 of this Policy (Cloudflare, Railway, Anthropic, Resend, Google, iPay88, GitHub Pages), each under contractual data-protection commitments.'),
      bullet('Government agencies, courts or regulators where required by Malaysian law.'),
      p('We do NOT sell your data to third parties or use it for advertising.'),
      h3('7.6 Cross-border transfers'),
      p('Some data is processed outside Malaysia: our application database and backend are hosted by Railway in Singapore; tongue images are stored by Cloudflare R2 in the Asia-Pacific region; tongue images and constitution questionnaire text are sent to Anthropic (United States) for AI inference; transactional email content is processed by Resend (Japan). We rely on your explicit consent and the necessity of these transfers for the requested service. Each transfer is over TLS 1.2+ and the recipient is contractually committed to applicable data-protection standards.'),
      h3('7.7 Retention'),
      p('We retain personal data only as long as necessary. Clinical records are retained for 7 years per Malaysian medical-record norms (subject to counsel confirmation). Transactional email codes auto-expire after 15 minutes. Audit logs are retained for 2 years.'),
      h3('7.8 Security'),
      bullet('Passwords are hashed with bcrypt; we cannot read your plaintext password.'),
      bullet('Connections are encrypted in transit with TLS 1.2 or higher.'),
      bullet('Tongue images are encrypted at rest (AES-256) on Cloudflare R2.'),
      bullet('Access to personal data is role-restricted; staff access is audit-logged.'),
      bullet('Two-factor authentication is encouraged for practitioner and admin accounts.'),
      h3('7.9 Your rights'),
      p('Under PDPA, you have the right to:'),
      bullet('Access the personal data we hold about you.'),
      bullet('Correct inaccurate or incomplete data.'),
      bullet('Withdraw consent and request deletion (subject to medical-record retention obligations).'),
      bullet('Object to direct marketing.'),
      bullet('Receive a copy of your data in a portable format (per PDPA Amendment 2024 once in force).'),
      p('To exercise these rights, contact our Data Protection contact at support@hansmedtcm.com. We aim to respond within 21 days.'),
      h3('7.10 Children'),
      p('Our service is intended for users aged 18 and over. Patients under 18 require parental consent (working assumption — final mechanism to be set by counsel).'),
      h3('7.11 Updates to this policy'),
      p('We may update this Policy from time to time. Material changes will be notified to active users via email at least 14 days before taking effect.'),
      h3('7.12 Contact'),
      bullet('Email: support@hansmedtcm.com'),
      bullet('Mail: [Address to be confirmed]'),
      bullet('Data Protection Commissioner of Malaysia: https://www.pdp.gov.my/'),
      pageBreak(),

      // === 8. TERMS OF SERVICE ===
      h1('8. Draft Terms of Service'),
      note('Suggested public URL: https://hansmedtcm.com/v2/terms.html.'),
      h3('8.1 Acceptance'),
      p('By creating an account or using the HansMed Modern TCM service, you agree to these Terms.'),
      h3('8.2 Service description'),
      p('HansMed is a telehealth platform that facilitates wellness assessments, online TCM consultations, and herbal medicine fulfilment. AI-assisted features (tongue analysis, constitution questionnaires) are decision-support tools and are not medical diagnoses. Every prescription is reviewed and approved by a licensed TCM practitioner.'),
      h3('8.3 Eligibility'),
      bullet('You must be at least 18 years old, or have parental/guardian consent.'),
      bullet('You must provide accurate registration information.'),
      bullet('You are responsible for the security of your account credentials.'),
      h3('8.4 Medical disclaimer'),
      p('HansMed does not provide emergency medical care. If you experience a medical emergency, contact emergency services (999 in Malaysia) immediately. Information on this platform is not a substitute for in-person diagnosis where clinically required.'),
      h3('8.5 Practitioner relationship'),
      p('Consultations are between you and the practitioner. HansMed acts as a technology platform and is not the medical service provider. Each practitioner is independently licensed under the Traditional and Complementary Medicine Act 2016.'),
      h3('8.6 Payment and refunds'),
      p('Consultation fees and herbal medicine costs are processed by iPay88 (or other approved processors). Refunds are governed by our Refund Policy, available at the consultation booking screen.'),
      h3('8.7 Acceptable use'),
      p('You agree not to: misuse the service; impersonate another person; upload content you do not have rights to; attempt to compromise the platform’s security; or use automated tools to scrape data.'),
      h3('8.8 Account suspension'),
      p('We may suspend or terminate accounts that violate these Terms or applicable law.'),
      h3('8.9 Limitation of liability'),
      p('To the extent permitted by Malaysian law, HansMed’s liability is limited to fees paid in the 12 months preceding the claim. We are not liable for clinical outcomes; clinical responsibility lies with the practitioner.'),
      h3('8.10 Governing law'),
      p('These Terms are governed by the laws of Malaysia. Disputes are subject to the exclusive jurisdiction of the Malaysian courts.'),
      h3('8.11 Changes'),
      p('Material changes to these Terms will be notified at least 14 days before taking effect.'),
      pageBreak(),

      // === 9. CONSENT MECHANISMS ===
      h1('9. Consent Mechanisms (Draft UI Texts)'),
      p('Each consent below is implemented as a separate checkbox at the registration screen or relevant action point. None are pre-ticked. Each is logged in the audit trail with timestamp and version.'),

      h3('9.1 PDPA Consent (registration)'),
      p('Checkbox label (English):'),
      pBold('I consent to HansMed Modern TCM processing my personal data (including name, email, phone, and health information such as symptoms, tongue images, and constitution questionnaire responses) in accordance with the Privacy Policy and Malaysia’s Personal Data Protection Act 2010.'),
      p('Checkbox label (Bahasa Malaysia):'),
      pBold('Saya bersetuju HansMed Modern TCM memproses data peribadi saya (termasuk nama, e-mel, nombor telefon, dan maklumat kesihatan seperti gejala, imej lidah, dan jawapan soal selidik konstitusi) menurut Polisi Privasi dan Akta Perlindungan Data Peribadi 2010 Malaysia.'),
      p('Checkbox label (中文):'),
      pBold('本人同意HansMed依據《隱私政策》及《2010年马来西亚個人資料保護法》處理本人個人資料（包括姓名、電郵、電話、及症狀、舌象、體質問卷答案等健康資訊）。'),

      h3('9.2 AI Processing Consent (registration)'),
      p('Checkbox label (English):'),
      pBold('I understand that HansMed uses AI-assisted wellness tools (tongue image analysis, constitution questionnaires) which are NOT medical diagnoses. All prescriptions and clinical guidance are issued by licensed TCM practitioners after they review the AI output. I consent to my tongue images and questionnaire responses being processed by AI services located outside Malaysia (United States) for this purpose.'),
      p('Checkbox label (Bahasa Malaysia):'),
      pBold('Saya memahami HansMed menggunakan alat kesihatan berbantukan AI (analisis imej lidah, soal selidik konstitusi) yang BUKAN diagnosis perubatan. Semua preskripsi dan nasihat klinikal dikeluarkan oleh pengamal TCM berlesen selepas mereka menyemak output AI. Saya bersetuju imej lidah dan jawapan soal selidik saya diproses oleh perkhidmatan AI yang terletak di luar Malaysia (Amerika Syarikat) untuk tujuan tersebut.'),
      p('Checkbox label (中文):'),
      pBold('本人知悉HansMed使用人工智能輔助健康工具（舌象分析、體質問卷），並非醫療診斷。所有處方及臨床建議皆由註冊中醫師審核AI輸出後出具。本人同意舌象圖片及問卷答案由位於馬來西亞境外（美國）之AI服務處理。'),

      h3('9.3 Marketing Consent (separate, opt-in only)'),
      p('Checkbox label (English):'),
      pBold('I would like to receive occasional newsletters, wellness tips, and promotional offers from HansMed Modern TCM via email. I can unsubscribe at any time. (Unticked by default; not required to use the service.)'),

      h3('9.4 Video Consultation Consent (per appointment)'),
      p('Modal text shown when joining a video consultation:'),
      pBold('You are about to start a video consultation with [Practitioner Name]. The video stream is end-to-end encrypted and is NOT recorded or stored by HansMed. Notes taken by the practitioner during the consultation are saved as part of your medical record and retained per the Privacy Policy. Click “Join” to confirm.'),
      pageBreak(),

      // === 10. DATA SUBJECT RIGHTS ===
      h1('10. Data Subject Rights — Procedures'),
      p('Procedures HansMed will follow when a user exercises their PDPA rights. Counsel to confirm response timelines and any conflicts with T&CM Act retention obligations.'),
      h3('10.1 Access requests'),
      p('Users email support@hansmedtcm.com from their registered address. We verify identity (account email match plus one additional factor: phone or government ID). We provide a structured export of personal data within 21 calendar days. Format: PDF and CSV.'),
      h3('10.2 Correction requests'),
      p('Users can self-edit profile fields in the patient portal. Health-record corrections require practitioner endorsement and are tracked in the audit log (original value preserved alongside the correction).'),
      h3('10.3 Erasure / withdrawal of consent'),
      p('On request, identifying data is anonymised. Clinical records are retained for the legally mandated period under T&CM Act 2016. After the retention period, all records are deleted. The user is informed of this dual posture before the request is finalised.'),
      h3('10.4 Portability'),
      p('Per PDPA Amendment 2024 (once in force), we will provide structured data export in a machine-readable format on request. Format: JSON.'),
      h3('10.5 Complaints'),
      p('Users may complain to the Department of Personal Data Protection Malaysia (https://www.pdp.gov.my/) if they are not satisfied with our response.'),
      pageBreak(),

      // === 11. DATA BREACH ===
      h1('11. Data Breach Response Plan'),
      h3('11.1 Detection'),
      bullet('Continuous monitoring of authentication logs for unusual patterns (failed logins, geolocation anomalies).'),
      bullet('Quarterly external review (TBC — counsel to advise on independent audit cadence).'),
      bullet('Reports from users via support@hansmedtcm.com are escalated within 1 hour.'),
      h3('11.2 Containment'),
      bullet('Affected access tokens are revoked.'),
      bullet('Compromised credentials are forced to reset.'),
      bullet('Network-level blocks applied via Cloudflare WAF.'),
      bullet('Incident commander assigned within 1 hour of detection.'),
      h3('11.3 Assessment'),
      p('Risk assessment within 24 hours: scope, data categories affected, number of users impacted, likely consequences.'),
      h3('11.4 Notification'),
      bullet('Affected users notified by email within 72 hours of confirmed breach.'),
      bullet('Department of Personal Data Protection Malaysia notified within 72 hours per PDPA Amendment 2024 (counsel to confirm exact threshold and timeframe).'),
      bullet('If breach is severe (e.g., affects >100 users or includes health data), public notice on the website.'),
      h3('11.5 Documentation'),
      p('Every incident is logged in an internal incident register with timeline, scope, root cause, and remediation. Register retained for 6 years.'),
      pageBreak(),

      // === 12. RETENTION SCHEDULE ===
      h1('12. Data Retention Schedule'),
      makeTable(
        ['Data category', 'Retention period', 'Trigger to delete', 'Notes'],
        [
          ['Account credentials', 'Until account closure + 7 years', 'Account closure + retention window', 'Email and hashed password kept for audit'],
          ['Patient profile (non-clinical)', 'Until account closure', 'Account closure', 'Anonymise on erasure request'],
          ['Clinical records (consultation notes, prescriptions)', '7 years from last consultation', '7 years', 'Per T&CM Act 2016 norm — counsel to confirm'],
          ['Tongue images', '7 years from upload', '7 days from soft-delete (immediate purge); 7 years from upload otherwise', 'R2 cron purges expired'],
          ['Audit logs', '2 years', '2 years', 'Login attempts, admin actions'],
          ['Email verification codes', '15 minutes', 'Auto-expiry', 'Hashed before storage'],
          ['Password reset codes', '15 minutes', 'Auto-expiry', 'Hashed before storage'],
          ['Payment metadata', '7 years', '7 years', 'Tax / audit retention'],
          ['Marketing preferences', 'Until unsubscribed + 30 days', 'Unsubscribe + 30 days', 'Buffer for re-subscribe'],
          ['Backups', '30 days', 'Rolling', 'Encrypted; per Railway managed-DB defaults'],
        ],
        [2400, 1700, 2300, 2626]
      ),
      pageBreak(),

      // === 13. PDPN ===
      h1('13. Personal Data Protection Notice (PDPN) — Trilingual Drafts'),
      p('PDPA 2010 §7 requires the PDPN to be published in English and Bahasa Malaysia. We additionally publish a Mandarin Chinese version for accessibility (not legally required).'),

      h3('13.1 English version'),
      pBold('Personal Data Protection Notice'),
      p('HansMed Modern TCM (“we”, “us”) is committed to protecting your personal data in accordance with the Personal Data Protection Act 2010.'),
      p('Personal data we collect: name, contact details (email, phone), health-related information you provide (including tongue images, symptoms, constitution responses), and information about your use of our services. This data is collected when you register, when you consult with a practitioner, when you make a purchase, and when you contact us for support.'),
      p('We collect this data to: provide the telehealth services you request, facilitate consultations and prescriptions, communicate with you, process payments, and meet our legal record-keeping obligations.'),
      p('Your data may be disclosed to: the licensed TCM practitioner you consult, partner pharmacies fulfilling your prescription, our service providers listed in our Privacy Policy, and government agencies where required by law.'),
      p('Some processing occurs outside Malaysia: application database hosted in Singapore (Railway), tongue image storage in the Asia-Pacific region (Cloudflare R2), AI inference in the United States (Anthropic), and transactional email in Japan (Resend) — under safeguards including TLS encryption and data-protection contracts.'),
      p('You have the right to access and correct your personal data, withdraw consent, and lodge complaints. To exercise these rights, contact support@hansmedtcm.com.'),
      p('It is OBLIGATORY to provide the data marked “required” at registration. Without this, we cannot create your account or provide the requested services.'),

      h3('13.2 Bahasa Malaysia version'),
      pBold('Notis Perlindungan Data Peribadi'),
      p('HansMed Modern TCM (“kami”) komited untuk melindungi data peribadi anda menurut Akta Perlindungan Data Peribadi 2010.'),
      p('Data peribadi yang kami kumpul: nama, butiran hubungan (e-mel, nombor telefon), maklumat kesihatan yang anda berikan (termasuk imej lidah, gejala, jawapan konstitusi), dan maklumat penggunaan perkhidmatan kami. Data ini dikumpul semasa pendaftaran, perundingan dengan pengamal, pembelian, dan apabila anda menghubungi kami.'),
      p('Kami mengumpul data ini untuk: menyediakan perkhidmatan telekesihatan, memudahkan perundingan dan preskripsi, berkomunikasi dengan anda, memproses pembayaran, dan memenuhi obligasi penyimpanan rekod undang-undang.'),
      p('Data anda mungkin dikongsi dengan: pengamal TCM yang anda berunding, farmasi rakan kongsi yang memenuhi preskripsi, pembekal perkhidmatan kami seperti yang disenaraikan dalam Polisi Privasi, dan agensi kerajaan apabila diperlukan oleh undang-undang.'),
      p('Sebahagian pemprosesan berlaku di luar Malaysia: pangkalan data aplikasi di Singapura (Railway), penyimpanan imej lidah di rantau Asia-Pasifik (Cloudflare R2), inferens AI di Amerika Syarikat (Anthropic), dan e-mel transaksi di Jepun (Resend) — di bawah perlindungan termasuk penyulitan TLS dan kontrak perlindungan data.'),
      p('Anda berhak untuk mengakses dan membetulkan data peribadi anda, menarik balik persetujuan, dan membuat aduan. Untuk menggunakan hak ini, hubungi support@hansmedtcm.com.'),
      p('Adalah WAJIB untuk memberikan data yang ditandakan “required” semasa pendaftaran. Tanpa data ini, kami tidak dapat membuka akaun anda atau menyediakan perkhidmatan yang diminta.'),

      h3('13.3 Mandarin Chinese version'),
      pBold('個人資料保護告示'),
      p('HansMed漢方現代中醫（「本公司」）承諾依據《2010年马來西亞個人資料保護法》保護您的個人資料。'),
      p('本公司所收集的個人資料包括：姓名、連絡資料（電郵、電話）、您提供之健康相關資訊（包含舌象圖片、症狀、體質問卷答案）以及您使用本服務之資訊。'),
      p('收集目的：提供您所請求的遠程醫療服務、促成診療與處方、與您沟通、處理付款，並履行法定記錄保存責任。'),
      p('所揭露之對象：您請求診療之註冊中醫師、合作藥房、本公司隱私政策中列出之服務提供者，以及依法請求之政府機關。'),
      p('部分資料處理位於馬來西亞境外：應用程式資料庫位於新加坡（Railway）、舌象圖片儲存於亞太區（Cloudflare R2）、AI推論位於美國（Anthropic）、交易電郵處理於日本（Resend），均受TLS加密及資料保護合約保障。'),
      p('您有權存取與更正個人資料、撤回同意及提出投訴。請電郵 support@hansmedtcm.com。'),
      p('註冊時標記「required」之資料為必填。若未提供，本公司無法為您開設帳戶或提供服務。'),
      pageBreak(),

      // === 14. MALAYSIA ===
      h1('14. Malaysia-Specific Compliance Items'),
      h3('14.1 PDPA 2010'),
      bullet('Personal Data Protection Notice (§7) — see Section 13.'),
      bullet('Sensitive personal data — explicit consent (§40). See Section 9.1.'),
      bullet('Disclosure Principle (§10) — Vendor list at Section 5.'),
      bullet('Security Principle (§11) — see Section 7.8 of Privacy Policy.'),
      bullet('Retention Principle (§12) — see Section 12.'),
      bullet('Cross-border transfers (§129) — see Section 6.'),
      h3('14.2 PDPA Amendment 2024'),
      bullet('Mandatory data breach notification — see Section 11.'),
      bullet('Data Protection Officer threshold — counsel to advise (Decision Q2).'),
      bullet('Right of data portability — see Section 10.4.'),
      bullet('Increased penalties — noted; counsel to advise on insurance.'),
      h3('14.3 T&CM Act 2016'),
      bullet('Practitioner registration — each TCM doctor onboarded must hold valid T&CM Council registration. We will collect and verify the registration number.'),
      bullet('Record-keeping by practitioners — our platform stores consultation records on the practitioner’s behalf for the legally mandated period.'),
      bullet('Counsel to advise whether HansMed-as-platform has additional T&CM-specific obligations beyond facilitating practitioner compliance (Decision Q10).'),
      h3('14.4 MOH Telemedicine Guidelines'),
      bullet('Although T&CM is a separate Council from conventional medicine, MOH telemedicine guidelines may inform best practice on consent, identity verification, and remote-prescribing safeguards. Counsel to confirm applicability.'),
      h3('14.5 Consumer Protection Act 1999'),
      bullet('Refund / cancellation policy required for prepaid services. Draft policy to follow once payment integration is finalised.'),
      pageBreak(),

      // === 15. PAYMENT ===
      h1('15. Payment Processor Disclosure (iPay88)'),
      h3('15.1 Selected Provider'),
      p('HansMed has selected iPay88 (NTT Data Group, Malaysia) as the payment processor for the soft-launch and beyond. iPay88 supports Malaysian payment methods including FPX (online banking), Touch ‘n Go eWallet, ShopeePay, GrabPay, Boost, and Visa/Mastercard/Amex credit cards.'),
      h3('15.2 Data Flow'),
      bullet('At checkout, the user is redirected to iPay88’s hosted payment page.'),
      bullet('Card / wallet credentials are entered on iPay88’s page; HansMed never sees this data.'),
      bullet('iPay88 returns a payment status callback to our backend, including: order ID, amount, status, masked card / wallet identifier.'),
      bullet('We store: order ID, amount, status, payment method type. We do NOT store card numbers, CVV, or wallet PINs.'),
      h3('15.3 PCI-DSS Posture'),
      p('By using iPay88’s hosted page, HansMed reduces its PCI-DSS scope to SAQ-A (the lightest tier). Card data never enters our systems. iPay88 is PCI-DSS Level 1 certified.'),
      h3('15.4 Refund Mechanism'),
      bullet('Refunds initiated via iPay88’s merchant dashboard or API.'),
      bullet('Refund timeline: typically 7–14 business days back to original payment method.'),
      bullet('Cancellation policy: TBC by counsel — must comply with Consumer Protection Act 1999.'),
      h3('15.5 Counsel guidance requested'),
      bullet('Confirm Merchant Agreement language is acceptable.'),
      bullet('Advise on disclosing iPay88 in the Privacy Policy and Personal Data Protection Notice.'),
      bullet('Advise on the chargeback / dispute resolution language for the user-facing Terms.'),
      pageBreak(),

      // === 16. REFERENCES ===
      h1('16. References'),
      bullet('Personal Data Protection Act 2010 (Malaysia) — https://www.pdp.gov.my/'),
      bullet('Personal Data Protection (Amendment) Act 2024 — confirm currency with counsel.'),
      bullet('Traditional and Complementary Medicine Act 2016  — https://tcm.moh.gov.my/'),
      bullet('Consumer Protection Act 1999 (Malaysia).'),
      bullet('Anthropic Commercial Terms of Service — https://www.anthropic.com/legal/commercial-terms'),
      bullet('Cloudflare Data Processing Addendum — https://www.cloudflare.com/cloudflare-customer-dpa/'),
      bullet('Resend Data Processing Addendum — https://resend.com/legal/dpa'),
      bullet('Railway Data Processing Addendum — https://railway.app/legal/dpa'),
      bullet('iPay88 Merchant Agreement — obtained on signing.'),

      h1('End of Document'),
      note('Please direct redlines and questions to hansmed.moderntcm@gmail.com.'),
    ],
  }],
});

const out = '/sessions/lucid-gallant-goldberg/mnt/Hansmed-system/legal/PDPA-Compliance-Package-DRAFT.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(out, buf);
  console.log('Wrote ' + out + ' (' + buf.length + ' bytes)');
});
