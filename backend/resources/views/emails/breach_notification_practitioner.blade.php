{{--
    Practitioner breach notification — bilingual stacked view.
    English (canonical) first; Traditional Chinese second.
    Rendered by App\Mail\BreachNotificationPractitionerMail.
    Variables:
      $practitioner  — App\Models\User instance (doctor or pharmacy)
      $privacyEmail  — string, e.g. privacy@hansmedtcm.com

    Locale strategy (post-2026-05-18 code review): each __() call passes
    the locale explicitly via the third argument. No app()->setLocale()
    mid-render, so there is no global state to leak if a translation
    call throws.
--}}
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HansMed Practitioner Notice</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 0 auto; padding: 20px;">

{{-- ENGLISH BLOCK --}}

<p>{{ __('breach_notification_practitioner.salutation', [], 'en') }}</p>
<p>{{ __('breach_notification_practitioner.opening', [], 'en') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_happened', [], 'en') }}</h3>
<p>{{ __('breach_notification_practitioner.what_happened', [], 'en') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_technical_scope', [], 'en') }}</h3>
<p>{{ __('breach_notification_practitioner.technical_scope_intro', [], 'en') }}</p>
<ul>
    <li>{{ __('breach_notification_practitioner.technical_scope_1', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_2', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_3', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_4', [], 'en') }}</li>
</ul>
<p>{{ __('breach_notification_practitioner.technical_scope_summary', [], 'en') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_we_have_done', [], 'en') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_1', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_2', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_3', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_4', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_5', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_6', [], 'en') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_7', [], 'en') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_forensic_limitations', [], 'en') }}</h3>
<p>{{ __('breach_notification_practitioner.forensic_limitations', [], 'en') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_professional_obligations', [], 'en') }}</h3>
<p>{{ __('breach_notification_practitioner.professional_obligations', [], 'en') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_request_detailed', [], 'en') }}</h3>
<p>{!! __('breach_notification_practitioner.request_detailed', ['privacy_email' => $privacyEmail], 'en') !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_account_hygiene', [], 'en') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.account_hygiene_1', [], 'en') }}</li>
    <li>{!! __('breach_notification_practitioner.account_hygiene_2', ['privacy_email' => $privacyEmail], 'en') !!}</li>
    <li>{{ __('breach_notification_practitioner.account_hygiene_3', [], 'en') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_patient_comms', [], 'en') }}</h3>
<p>{!! __('breach_notification_practitioner.patient_comms', ['privacy_email' => $privacyEmail], 'en') !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_complaints', [], 'en') }}</h3>
<p>{!! __('breach_notification_practitioner.complaints', ['privacy_email' => $privacyEmail], 'en') !!}</p>

<p>{{ __('breach_notification_practitioner.closing', [], 'en') }}</p>

<p>{{ __('breach_notification_practitioner.signoff', [], 'en') }}<br>
<strong>{{ __('breach_notification_practitioner.signatory_name', [], 'en') }}</strong><br>
{{ __('breach_notification_practitioner.signatory_title', [], 'en') }}<br>
{{ __('breach_notification_practitioner.signatory_entity', [], 'en') }}<br>
{{ __('breach_notification_practitioner.signatory_company_no', [], 'en') }}</p>

<hr style="margin: 40px 0; border: none; border-top: 2px solid #888;">

{{-- 繁體中文 BLOCK --}}

<p>{{ __('breach_notification_practitioner.salutation', [], 'zh') }}</p>
<p>{{ __('breach_notification_practitioner.opening', [], 'zh') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_happened', [], 'zh') }}</h3>
<p>{{ __('breach_notification_practitioner.what_happened', [], 'zh') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_technical_scope', [], 'zh') }}</h3>
<p>{{ __('breach_notification_practitioner.technical_scope_intro', [], 'zh') }}</p>
<ul>
    <li>{{ __('breach_notification_practitioner.technical_scope_1', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_2', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_3', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_4', [], 'zh') }}</li>
</ul>
<p>{{ __('breach_notification_practitioner.technical_scope_summary', [], 'zh') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_we_have_done', [], 'zh') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_1', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_2', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_3', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_4', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_5', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_6', [], 'zh') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_7', [], 'zh') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_forensic_limitations', [], 'zh') }}</h3>
<p>{{ __('breach_notification_practitioner.forensic_limitations', [], 'zh') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_professional_obligations', [], 'zh') }}</h3>
<p>{{ __('breach_notification_practitioner.professional_obligations', [], 'zh') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_request_detailed', [], 'zh') }}</h3>
<p>{!! __('breach_notification_practitioner.request_detailed', ['privacy_email' => $privacyEmail], 'zh') !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_account_hygiene', [], 'zh') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.account_hygiene_1', [], 'zh') }}</li>
    <li>{!! __('breach_notification_practitioner.account_hygiene_2', ['privacy_email' => $privacyEmail], 'zh') !!}</li>
    <li>{{ __('breach_notification_practitioner.account_hygiene_3', [], 'zh') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_patient_comms', [], 'zh') }}</h3>
<p>{!! __('breach_notification_practitioner.patient_comms', ['privacy_email' => $privacyEmail], 'zh') !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_complaints', [], 'zh') }}</h3>
<p>{!! __('breach_notification_practitioner.complaints', ['privacy_email' => $privacyEmail], 'zh') !!}</p>

<p>{{ __('breach_notification_practitioner.closing', [], 'zh') }}</p>

<p>{{ __('breach_notification_practitioner.signoff', [], 'zh') }}<br>
<strong>{{ __('breach_notification_practitioner.signatory_name', [], 'zh') }}</strong><br>
{{ __('breach_notification_practitioner.signatory_title', [], 'zh') }}<br>
{{ __('breach_notification_practitioner.signatory_entity', [], 'zh') }}<br>
{{ __('breach_notification_practitioner.signatory_company_no', [], 'zh') }}</p>

</body>
</html>
