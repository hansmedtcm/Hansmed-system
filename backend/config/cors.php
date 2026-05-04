<?php

/*
|--------------------------------------------------------------------------
| CORS — restricted to known HansMed origins
|--------------------------------------------------------------------------
| Previously '*' which let any website on the internet call this API
| from a logged-in user's browser. That's a real risk on a healthcare
| platform — an XSS on an unrelated site could pivot into here.
|
| Allow:
|   • The GitHub Pages frontend (the v2 site we serve from)
|   • The future custom domain (set via APP_FRONTEND_ORIGIN env var so
|     it can change per environment without a code deploy)
|   • localhost on common dev ports for local development
|
| Add more domains by appending env-driven entries below — don't
| broaden the static list to '*'.
*/

$frontend = env('APP_FRONTEND_ORIGIN');

$allowed = array_values(array_filter([
    // Brief #21: hansmedtcm.com is the new primary frontend host
    // (apex + www both allowed). github.io kept as a transition
    // fallback so any bookmarked /Hansmed-system/ links keep
    // working; remove after 2-4 weeks of stable apex operation.
    'https://hansmedtcm.com',
    'https://www.hansmedtcm.com',
    'https://hansmedtcm.github.io',
    $frontend,
    // Local development
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // Allow the file:// origin some local previews report as 'null'
    'null',
]));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'webhooks/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $allowed,
    /*
     * Patterns intentionally empty — keep the explicit list above as
     * the only way an origin gets in. Don't add wildcard patterns
     * here without a security review.
     */
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With', 'X-CSRF-TOKEN'],
    'exposed_headers' => [],
    'max_age' => 86400,
    /*
     * supports_credentials must stay false unless we move tokens to
     * httpOnly cookies (separate roadmap item). With Sanctum bearer
     * tokens in localStorage, the browser doesn't need to send
     * cookies cross-origin so this flag is safe at false.
     */
    'supports_credentials' => false,
];
