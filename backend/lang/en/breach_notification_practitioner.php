<?php

/*
 * Practitioner-facing breach notification — English (canonical).
 * Companion to lang/zh/breach_notification_practitioner.php (key-for-key).
 * Source: _internal/breach-register/HM-BR-2026-001-appendix-d2-practitioner-template.md
 */

return [

    'subject' => 'Security incident affecting the HansMed platform — practitioner notification',

    'salutation' => 'Dear Practitioner,',

    'opening' => 'We are writing to inform you of a security incident affecting the HansMed Modern TCM platform. As a registered T&CM practitioner with an account on our platform, you have both a professional interest in understanding what occurred and, potentially, independent reporting obligations under the T&CM Act 2016 and the T&CM Council Code of Professional Conduct. We are providing you with the scope detail you need to make your own assessment.',

    'heading_what_happened' => 'What happened',
    'what_happened' => 'On 15 May 2026 we discovered that a configuration file containing administrator login credentials for the HansMed platform had been included in a publicly viewable area of our software code repository. The file had been there since 14 April 2026 — a period of 30 days. We removed the file from public view the same day we discovered it, cancelled every active platform login session, and changed all affected internal passwords. We then notified the Personal Data Protection Commissioner under section 12B of the Personal Data Protection Act 2010 (as amended in 2024).',

    'heading_technical_scope' => 'Technical scope of what was reachable',
    'technical_scope_intro' => 'The leaked credentials granted administrator-level access to the HansMed production backend. A holder of those credentials, if they used them, would have been able to:',
    'technical_scope_1' => 'Read the full patient record for any patient on the platform — including identifying data (name, NRIC, telephone, address, date of birth, gender) and full clinical record (medical history, allergies, current medications, family history, blood type, anthropometric data, consultation case notes, prescription records including herbal formulae and dosages, tongue diagnostic images, AI-assisted constitution analysis outputs).',
    'technical_scope_2' => 'Read the full record of any prescription issued on the platform, including the issuing practitioner\'s name and the dispensing pharmacy\'s records.',
    'technical_scope_3' => 'Read your practitioner profile, including your T&CM Council registration details, practice address, and qualification documents.',
    'technical_scope_4' => 'Modify or revoke any prescription, and reset the password on any practitioner account (which would have triggered a forced logout of that account; you may have noticed this if your session was abruptly invalidated on 15 May).',
    'technical_scope_summary' => 'In short: any patient case record you authored on the platform, any prescription you issued on the platform, and your own practitioner profile data were within the scope of the leaked credentials during the exposure period.',

    'heading_what_we_have_done' => 'What we have done',
    'what_we_have_done_1' => 'Cancelled all 87 active platform login tokens within hours of discovery on 15 May.',
    'what_we_have_done_2' => 'Rotated all affected internal passwords.',
    'what_we_have_done_3' => 'Removed the file from public view and updated our configuration to prevent recurrence of this specific class of exposure.',
    'what_we_have_done_4' => 'Deployed an emergency tool to cancel every active platform session within seconds if a similar situation arises.',
    'what_we_have_done_5' => 'Implemented application-level encryption-at-rest on the sensitive health fields in our database.',
    'what_we_have_done_6' => 'Reviewed our server access logs covering the period we are able to recover, looking for any sign that the credentials were used by an outside party.',
    'what_we_have_done_7' => 'Engaged Malaysian privacy and healthcare counsel.',

    'heading_forensic_limitations' => 'Forensic limitations — disclosed in full',
    'forensic_limitations' => 'We are able to recover server access logs covering only approximately 2.2 per cent of the 30-day exposure period (the recoverable window is the 15-hour period leading up to discovery and containment). Within that recoverable window we found no evidence of unauthorised access — no unfamiliar IP addresses, no unfamiliar browser fingerprints, no failed authorisation attempts, and no access to high-risk endpoints by anyone other than the data controller\'s known device. For the remaining 97.8 per cent of the exposure period our log retention is insufficient to make a determination either way. We cannot positively prove that no unauthorised access occurred. We can tell you that the credentials have been cancelled and can no longer be used, and that we have found no evidence of exploitation in the data we do have.',

    'heading_professional_obligations' => 'Your independent professional obligations',
    'professional_obligations' => 'As a registered T&CM practitioner you are bound by confidentiality duties under the T&CM Act 2016 and the T&CM Council Code of Professional Conduct that are independent of our duties as the platform operator. Our notification to you does NOT discharge any self-reporting obligation you may have under your professional code. Whether to notify the T&CM Council, the patients to whom you provided care via the platform, or any other body is a professional judgement we are not in a position to make on your behalf. We provide this notice and the scope detail above to support that judgement.',

    'heading_request_detailed' => 'Request for a detailed practitioner-specific scope account',
    'request_detailed' => 'If you would like a more detailed account of which specific records authored or accessed by you fell within the scope of the leaked credentials — for example, a list of the patient case records you authored on the platform during the exposure window, or the prescription records you issued — please reply to this email or contact our Data Protection Officer at :privacy_email. We will compile and provide that information on request, subject to the usual identity-verification steps.',

    'heading_account_hygiene' => 'Account hygiene',
    'account_hygiene_1' => 'We recommend you change your practitioner password as an extra precaution. Your practitioner password was not in the leaked file, but a routine rotation costs you nothing.',
    'account_hygiene_2' => 'If you have noticed any unfamiliar activity on your account — case records you do not recognise, prescriptions you did not issue, profile changes you did not make — please contact us immediately at :privacy_email.',
    'account_hygiene_3' => 'Be alert to phishing messages purporting to come from HansMed, the T&CM Council, or other authorities. We will never ask for your password, NRIC, banking details, or one-time codes by email.',

    'heading_patient_comms' => 'Patient communications',
    'patient_comms' => 'We are separately notifying every affected patient on the platform. You may receive questions from your patients about this incident. If you would like to coordinate your response, or if a patient asks you a question you would prefer we field directly, please refer them to :privacy_email.',

    'heading_complaints' => 'Complaints and rights',
    'complaints' => 'If you have concerns about how we have handled this incident or how we hold practitioner or patient personal data on our platform, you may contact our Data Protection Officer at :privacy_email, or lodge a complaint with the Personal Data Protection Commissioner at https://www.pdp.gov.my.',

    'closing' => 'We are sorry that this happened. We know that your professional reputation and your patients\' trust depend on the platforms you choose to use, and we have written this notice as completely as we can because we want you to have the information you need to act in your patients\' interests and to meet your own professional obligations.',

    'signoff' => 'Sincerely,',
    'signatory_name' => 'Hee Chee Koon',
    'signatory_title' => 'Chairman & Director',
    'signatory_entity' => 'HANSMED MODERN TCM SDN. BHD.',
    'signatory_company_no' => '(Company No. 202601016057 / 1678154-V)',

];
