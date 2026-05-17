{{--
    Patient breach notification — bilingual stacked email view.
    English (canonical) first; Traditional Chinese second.
    Matches platform's existing privacy-policy.html / portal.html pattern.

    Rendered by App\Mail\BreachNotificationMail. Variables:
      $patient        — App\Models\User instance
      $resetUrl       — string, full URL to platform password reset
      $privacyEmail   — string, e.g. privacy@hansmedtcm.com

    The {{ __('breach_notification.x', [...]) }} calls pull from
    lang/en/breach_notification.php when app()->setLocale('en'),
    then we explicitly setLocale('zh') for the second block.
--}}
@php
    // Render-time locale is irrelevant because we explicitly switch below.
    $originalLocale = app()->getLocale();
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HansMed Security Notice</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 640px; margin: 0 auto; padding: 20px;">

{{-- ========================================================== --}}
{{-- ENGLISH BLOCK                                              --}}
{{-- ========================================================== --}}
@php app()->setLocale('en'); @endphp

<p>{{ __('breach_notification.salutation', ['email' => $patient->email]) }}</p>

<p>{{ __('breach_notification.opening') }}</p>

<h3>{{ __('breach_notification.heading_what_happened') }}</h3>
<p>{{ __('breach_notification.what_happened') }}</p>

<h3>{{ __('breach_notification.heading_what_was_reachable') }}</h3>
<p>{{ __('breach_notification.what_was_reachable_intro') }}</p>
<ul>
    <li>{{ __('breach_notification.what_was_reachable_pii') }}</li>
    <li>{{ __('breach_notification.what_was_reachable_health') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_what_we_have_done') }}</h3>
<ul>
    <li>{{ __('breach_notification.what_we_have_done_1') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_2') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_3') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_4') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_5') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_6') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_7') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_8') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_cannot_tell_you') }}</h3>
<p>{{ __('breach_notification.cannot_tell_you') }}</p>

<h3>{{ __('breach_notification.heading_what_you_can_do') }}</h3>
<ul>
    <li>{!! __('breach_notification.what_you_can_do_password', ['reset_url' => $resetUrl]) !!}</li>
    <li>{!! __('breach_notification.what_you_can_do_phishing', ['privacy_email' => $privacyEmail]) !!}</li>
    <li>{{ __('breach_notification.what_you_can_do_nric') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_questions') }}</h3>
<p>{!! __('breach_notification.questions_dpo', ['privacy_email' => $privacyEmail]) !!}</p>
<p>{{ __('breach_notification.questions_pdpc') }}</p>

<p>{{ __('breach_notification.closing') }}</p>

<p>{{ __('breach_notification.signoff') }}<br>
<strong>{{ __('breach_notification.signatory_name') }}</strong><br>
{{ __('breach_notification.signatory_title') }}<br>
{{ __('breach_notification.signatory_entity') }}<br>
{{ __('breach_notification.signatory_company_no') }}</p>

<hr style="margin: 40px 0; border: none; border-top: 2px solid #888;">

{{-- ========================================================== --}}
{{-- 繁體中文 BLOCK                                              --}}
{{-- ========================================================== --}}
@php app()->setLocale('zh'); @endphp

<p>{{ __('breach_notification.salutation', ['email' => $patient->email]) }}</p>

<p>{{ __('breach_notification.opening') }}</p>

<h3>{{ __('breach_notification.heading_what_happened') }}</h3>
<p>{{ __('breach_notification.what_happened') }}</p>

<h3>{{ __('breach_notification.heading_what_was_reachable') }}</h3>
<p>{{ __('breach_notification.what_was_reachable_intro') }}</p>
<ul>
    <li>{{ __('breach_notification.what_was_reachable_pii') }}</li>
    <li>{{ __('breach_notification.what_was_reachable_health') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_what_we_have_done') }}</h3>
<ul>
    <li>{{ __('breach_notification.what_we_have_done_1') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_2') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_3') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_4') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_5') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_6') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_7') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_8') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_cannot_tell_you') }}</h3>
<p>{{ __('breach_notification.cannot_tell_you') }}</p>

<h3>{{ __('breach_notification.heading_what_you_can_do') }}</h3>
<ul>
    <li>{!! __('breach_notification.what_you_can_do_password', ['reset_url' => $resetUrl]) !!}</li>
    <li>{!! __('breach_notification.what_you_can_do_phishing', ['privacy_email' => $privacyEmail]) !!}</li>
    <li>{{ __('breach_notification.what_you_can_do_nric') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_questions') }}</h3>
<p>{!! __('breach_notification.questions_dpo', ['privacy_email' => $privacyEmail]) !!}</p>
<p>{{ __('breach_notification.questions_pdpc') }}</p>

<p>{{ __('breach_notification.closing') }}</p>

<p>{{ __('breach_notification.signoff') }}<br>
<strong>{{ __('breach_notification.signatory_name') }}</strong><br>
{{ __('breach_notification.signatory_title') }}<br>
{{ __('breach_notification.signatory_entity') }}<br>
{{ __('breach_notification.signatory_company_no') }}</p>

@php app()->setLocale($originalLocale); @endphp

</body>
</html>
