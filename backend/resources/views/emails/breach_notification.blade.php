{{--
    Patient breach notification — bilingual stacked email view.
    English (canonical) first; Traditional Chinese second.
    Matches platform's existing privacy-policy.html / portal.html pattern.

    Rendered by App\Mail\BreachNotificationMail. Variables:
      $patient        — App\Models\User instance
      $resetUrl       — string, full URL to platform password reset
      $privacyEmail   — string, e.g. privacy@hansmedtcm.com

    Locale strategy (post-2026-05-18 code review):
    Each translation call passes the locale explicitly via the third
    argument of __('key', [], 'locale'). This avoids the side-effect
    of app()->setLocale() mid-render, which leaks the locale if any
    __() throws an exception inside the render block. Cleaner than
    a try/finally wrapper because there's no global state to restore.
--}}
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

<p>{{ __('breach_notification.salutation', ['email' => $patient->email], 'en') }}</p>

<p>{{ __('breach_notification.opening', [], 'en') }}</p>

<h3>{{ __('breach_notification.heading_what_happened', [], 'en') }}</h3>
<p>{{ __('breach_notification.what_happened', [], 'en') }}</p>

<h3>{{ __('breach_notification.heading_what_was_reachable', [], 'en') }}</h3>
<p>{{ __('breach_notification.what_was_reachable_intro', [], 'en') }}</p>
<ul>
    <li>{{ __('breach_notification.what_was_reachable_pii', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_was_reachable_health', [], 'en') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_what_we_have_done', [], 'en') }}</h3>
<ul>
    <li>{{ __('breach_notification.what_we_have_done_1', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_2', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_3', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_4', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_5', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_6', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_7', [], 'en') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_8', [], 'en') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_cannot_tell_you', [], 'en') }}</h3>
<p>{{ __('breach_notification.cannot_tell_you', [], 'en') }}</p>

<h3>{{ __('breach_notification.heading_what_you_can_do', [], 'en') }}</h3>
<ul>
    <li>{!! __('breach_notification.what_you_can_do_password', ['reset_url' => $resetUrl], 'en') !!}</li>
    <li>{!! __('breach_notification.what_you_can_do_phishing', ['privacy_email' => $privacyEmail], 'en') !!}</li>
    <li>{{ __('breach_notification.what_you_can_do_nric', [], 'en') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_questions', [], 'en') }}</h3>
<p>{!! __('breach_notification.questions_dpo', ['privacy_email' => $privacyEmail], 'en') !!}</p>
<p>{{ __('breach_notification.questions_pdpc', [], 'en') }}</p>

<p>{{ __('breach_notification.closing', [], 'en') }}</p>

<p>{{ __('breach_notification.signoff', [], 'en') }}<br>
<strong>{{ __('breach_notification.signatory_name', [], 'en') }}</strong><br>
{{ __('breach_notification.signatory_title', [], 'en') }}<br>
{{ __('breach_notification.signatory_entity', [], 'en') }}<br>
{{ __('breach_notification.signatory_company_no', [], 'en') }}</p>

<hr style="margin: 40px 0; border: none; border-top: 2px solid #888;">

{{-- ========================================================== --}}
{{-- 繁體中文 BLOCK                                              --}}
{{-- ========================================================== --}}

<p>{{ __('breach_notification.salutation', ['email' => $patient->email], 'zh') }}</p>

<p>{{ __('breach_notification.opening', [], 'zh') }}</p>

<h3>{{ __('breach_notification.heading_what_happened', [], 'zh') }}</h3>
<p>{{ __('breach_notification.what_happened', [], 'zh') }}</p>

<h3>{{ __('breach_notification.heading_what_was_reachable', [], 'zh') }}</h3>
<p>{{ __('breach_notification.what_was_reachable_intro', [], 'zh') }}</p>
<ul>
    <li>{{ __('breach_notification.what_was_reachable_pii', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_was_reachable_health', [], 'zh') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_what_we_have_done', [], 'zh') }}</h3>
<ul>
    <li>{{ __('breach_notification.what_we_have_done_1', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_2', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_3', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_4', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_5', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_6', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_7', [], 'zh') }}</li>
    <li>{{ __('breach_notification.what_we_have_done_8', [], 'zh') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_cannot_tell_you', [], 'zh') }}</h3>
<p>{{ __('breach_notification.cannot_tell_you', [], 'zh') }}</p>

<h3>{{ __('breach_notification.heading_what_you_can_do', [], 'zh') }}</h3>
<ul>
    <li>{!! __('breach_notification.what_you_can_do_password', ['reset_url' => $resetUrl], 'zh') !!}</li>
    <li>{!! __('breach_notification.what_you_can_do_phishing', ['privacy_email' => $privacyEmail], 'zh') !!}</li>
    <li>{{ __('breach_notification.what_you_can_do_nric', [], 'zh') }}</li>
</ul>

<h3>{{ __('breach_notification.heading_questions', [], 'zh') }}</h3>
<p>{!! __('breach_notification.questions_dpo', ['privacy_email' => $privacyEmail], 'zh') !!}</p>
<p>{{ __('breach_notification.questions_pdpc', [], 'zh') }}</p>

<p>{{ __('breach_notification.closing', [], 'zh') }}</p>

<p>{{ __('breach_notification.signoff', [], 'zh') }}<br>
<strong>{{ __('breach_notification.signatory_name', [], 'zh') }}</strong><br>
{{ __('breach_notification.signatory_title', [], 'zh') }}<br>
{{ __('breach_notification.signatory_entity', [], 'zh') }}<br>
{{ __('breach_notification.signatory_company_no', [], 'zh') }}</p>

</body>
</html>
