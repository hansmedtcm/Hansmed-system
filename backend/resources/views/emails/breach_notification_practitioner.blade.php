{{--
    Practitioner breach notification — bilingual stacked view.
    English (canonical) first; Traditional Chinese second.
    Rendered by App\Mail\BreachNotificationPractitionerMail.
    Variables:
      $practitioner  — App\Models\User instance (doctor or pharmacy)
      $privacyEmail  — string, e.g. privacy@hansmedtcm.com
--}}
@php $originalLocale = app()->getLocale(); @endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HansMed Practitioner Notice</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 0 auto; padding: 20px;">

@php app()->setLocale('en'); @endphp

<p>{{ __('breach_notification_practitioner.salutation') }}</p>
<p>{{ __('breach_notification_practitioner.opening') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_happened') }}</h3>
<p>{{ __('breach_notification_practitioner.what_happened') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_technical_scope') }}</h3>
<p>{{ __('breach_notification_practitioner.technical_scope_intro') }}</p>
<ul>
    <li>{{ __('breach_notification_practitioner.technical_scope_1') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_2') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_3') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_4') }}</li>
</ul>
<p>{{ __('breach_notification_practitioner.technical_scope_summary') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_we_have_done') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_1') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_2') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_3') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_4') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_5') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_6') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_7') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_forensic_limitations') }}</h3>
<p>{{ __('breach_notification_practitioner.forensic_limitations') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_professional_obligations') }}</h3>
<p>{{ __('breach_notification_practitioner.professional_obligations') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_request_detailed') }}</h3>
<p>{!! __('breach_notification_practitioner.request_detailed', ['privacy_email' => $privacyEmail]) !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_account_hygiene') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.account_hygiene_1') }}</li>
    <li>{!! __('breach_notification_practitioner.account_hygiene_2', ['privacy_email' => $privacyEmail]) !!}</li>
    <li>{{ __('breach_notification_practitioner.account_hygiene_3') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_patient_comms') }}</h3>
<p>{!! __('breach_notification_practitioner.patient_comms', ['privacy_email' => $privacyEmail]) !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_complaints') }}</h3>
<p>{!! __('breach_notification_practitioner.complaints', ['privacy_email' => $privacyEmail]) !!}</p>

<p>{{ __('breach_notification_practitioner.closing') }}</p>

<p>{{ __('breach_notification_practitioner.signoff') }}<br>
<strong>{{ __('breach_notification_practitioner.signatory_name') }}</strong><br>
{{ __('breach_notification_practitioner.signatory_title') }}<br>
{{ __('breach_notification_practitioner.signatory_entity') }}<br>
{{ __('breach_notification_practitioner.signatory_company_no') }}</p>

<hr style="margin: 40px 0; border: none; border-top: 2px solid #888;">

@php app()->setLocale('zh'); @endphp

<p>{{ __('breach_notification_practitioner.salutation') }}</p>
<p>{{ __('breach_notification_practitioner.opening') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_happened') }}</h3>
<p>{{ __('breach_notification_practitioner.what_happened') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_technical_scope') }}</h3>
<p>{{ __('breach_notification_practitioner.technical_scope_intro') }}</p>
<ul>
    <li>{{ __('breach_notification_practitioner.technical_scope_1') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_2') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_3') }}</li>
    <li>{{ __('breach_notification_practitioner.technical_scope_4') }}</li>
</ul>
<p>{{ __('breach_notification_practitioner.technical_scope_summary') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_what_we_have_done') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_1') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_2') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_3') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_4') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_5') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_6') }}</li>
    <li>{{ __('breach_notification_practitioner.what_we_have_done_7') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_forensic_limitations') }}</h3>
<p>{{ __('breach_notification_practitioner.forensic_limitations') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_professional_obligations') }}</h3>
<p>{{ __('breach_notification_practitioner.professional_obligations') }}</p>

<h3>{{ __('breach_notification_practitioner.heading_request_detailed') }}</h3>
<p>{!! __('breach_notification_practitioner.request_detailed', ['privacy_email' => $privacyEmail]) !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_account_hygiene') }}</h3>
<ul>
    <li>{{ __('breach_notification_practitioner.account_hygiene_1') }}</li>
    <li>{!! __('breach_notification_practitioner.account_hygiene_2', ['privacy_email' => $privacyEmail]) !!}</li>
    <li>{{ __('breach_notification_practitioner.account_hygiene_3') }}</li>
</ul>

<h3>{{ __('breach_notification_practitioner.heading_patient_comms') }}</h3>
<p>{!! __('breach_notification_practitioner.patient_comms', ['privacy_email' => $privacyEmail]) !!}</p>

<h3>{{ __('breach_notification_practitioner.heading_complaints') }}</h3>
<p>{!! __('breach_notification_practitioner.complaints', ['privacy_email' => $privacyEmail]) !!}</p>

<p>{{ __('breach_notification_practitioner.closing') }}</p>

<p>{{ __('breach_notification_practitioner.signoff') }}<br>
<strong>{{ __('breach_notification_practitioner.signatory_name') }}</strong><br>
{{ __('breach_notification_practitioner.signatory_title') }}<br>
{{ __('breach_notification_practitioner.signatory_entity') }}<br>
{{ __('breach_notification_practitioner.signatory_company_no') }}</p>

@php app()->setLocale($originalLocale); @endphp

</body>
</html>
