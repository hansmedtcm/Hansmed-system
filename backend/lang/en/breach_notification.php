<?php

/*
 * Patient-facing breach notification — English (canonical).
 *
 * Companion to resources/lang/zh/breach_notification.php (key-for-key).
 * Used by App\Mail\BreachNotificationMail and the Artisan command
 * `php artisan breach:notify-patients`. Counsel-reviewed wording is
 * mirrored from _internal/breach-register/HM-BR-2026-001-appendix-d-dsn-template.md.
 *
 * Do NOT edit individual key text without re-aligning the zh/ file.
 * Translation discipline: when an EN key changes, the corresponding ZH
 * key must be updated in the same commit. The DispatchBreachNotification
 * command enforces key-set parity at runtime (refuses to dispatch if
 * the two files disagree on the set of keys).
 */

return [

    'subject' => 'Security incident affecting your HansMed account — please read',

    'salutation' => 'Dear :email,',

    'opening' => 'We are writing to inform you of a security incident affecting your HansMed Modern TCM account. We are sending this notice because Malaysian law requires it and because we believe you deserve to know exactly what happened.',

    'heading_what_happened' => 'What happened',

    'what_happened' => 'On 15 May 2026, during an internal review of our software code repository, we discovered that a configuration file containing administrator login credentials for our platform had been included in a publicly viewable area of that repository. The file had been there since 14 April 2026 — a period of 30 days. The credentials in that file, if used by someone outside our team, would have allowed access to patient information held in our system. We removed the file from public view the same day we discovered it, changed every affected password, and cancelled every active login session on the platform.',

    'heading_what_was_reachable' => 'What information was reachable',

    'what_was_reachable_intro' => 'The credentials, if used, would have allowed someone to view personal information we hold about you. This information includes:',

    'what_was_reachable_pii' => 'Your name, email address, telephone number, Malaysian NRIC number, date of birth, residential address, and gender.',

    'what_was_reachable_health' => 'Health information you provided to your TCM practitioner through the platform, including medical history, allergies, current medications, family medical history, blood type, height and weight, consultation notes, prescription records (including herbal formulae and dosages), tongue diagnostic images, and AI-assisted constitution analysis outputs.',

    'heading_what_we_have_done' => 'What we have done',

    'what_we_have_done_1' => 'Cancelled all 87 active platform login tokens within hours of discovery.',
    'what_we_have_done_2' => 'Changed the password on every affected internal account.',
    'what_we_have_done_3' => 'Removed the file from the publicly viewable area of the repository and updated our configuration to prevent the same type of file from being added again.',
    'what_we_have_done_4' => 'Deployed an emergency tool that lets us cancel every active platform session within seconds if a similar situation ever arises.',
    'what_we_have_done_5' => 'Implemented application-level encryption-at-rest on the sensitive health fields in our database (residential address, emergency contact details, allergies, medical history, current medications, family history).',
    'what_we_have_done_6' => 'Reviewed our server access logs covering the period we are able to recover, looking for any sign that the credentials were used by an outside party.',
    'what_we_have_done_7' => 'Reported the incident to the Personal Data Protection Commissioner under section 12B of the Personal Data Protection Act 2010 (as amended in 2024).',
    'what_we_have_done_8' => 'Engaged Malaysian privacy counsel to review our response.',

    'heading_cannot_tell_you' => 'What we honestly cannot tell you',

    'cannot_tell_you' => 'We can recover server access logs for only about 2.2 per cent of the 30-day period during which the credentials were exposed. Within that recoverable window we found no sign that anyone outside our team used the credentials. For the remaining 97.8 per cent of the period we cannot prove either way. We are not able to tell you with certainty that no unauthorised person accessed your information. We can tell you that we have found no evidence of such access in the data available to us, and that the credentials have been cancelled and can no longer be used.',

    'heading_what_you_can_do' => 'What you can do',

    'what_you_can_do_password' => 'Change your HansMed password as an extra precaution, even though your patient password was not in the exposed file. You can do this at :reset_url.',
    'what_you_can_do_phishing' => 'Watch for phishing. If someone contacts you claiming to be from HansMed and asks for your password, NRIC, banking details, or a one-time code, do not respond. We will never ask for these. Forward suspicious messages to :privacy_email.',
    'what_you_can_do_nric' => 'Be alert to misuse of your NRIC. If you notice any unfamiliar account opened in your name or any other sign of identity misuse, you may report it to the police and to the relevant institution.',

    'heading_questions' => 'Questions, complaints, and your rights',

    'questions_dpo' => 'If you have questions about this notice or about how we hold your personal data, please contact our Data Protection Officer at :privacy_email.',

    'questions_pdpc' => 'If you wish to lodge a complaint about how we have handled your personal data, you have the right to do so with the Personal Data Protection Commissioner. Contact details are published at https://www.pdp.gov.my.',

    'closing' => 'We are sorry that this happened. We have written this notice as plainly as we can because we want you to know exactly what occurred and what we are doing about it.',

    'signoff' => 'Sincerely,',

    'signatory_name' => 'Hee Chee Koon',
    'signatory_title' => 'Chairman & Director',
    'signatory_entity' => 'HANSMED MODERN TCM SDN. BHD.',
    'signatory_company_no' => '(Company No. 202601016057 / 1678154-V)',

];
