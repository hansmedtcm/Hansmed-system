<?php

return [

    'stripe' => [
        'secret'         => env('STRIPE_SECRET'),
        'publishable'    => env('STRIPE_PUBLISHABLE_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'currency'       => env('STRIPE_CURRENCY', 'myr'),
        // Malaysia payment methods supported by Stripe:
        // card, fpx, grabpay, touch_n_go (via Stripe), shopeepay
        'payment_methods' => ['card', 'fpx', 'grabpay'],
    ],

    'paypal' => [
        'client_id'     => env('PAYPAL_CLIENT_ID'),
        'client_secret' => env('PAYPAL_CLIENT_SECRET'),
        'mode'          => env('PAYPAL_MODE', 'sandbox'),
    ],

    'agora' => [
        'app_id'          => env('AGORA_APP_ID'),
        'app_certificate' => env('AGORA_APP_CERT'),
    ],

    // Renamed from 'tongue_diagnosis' on 2026-04-25 — see
    // BACKEND_RENAME_TODO.md. Same env var names so Railway secrets
    // don't need to change.
    'tongue_assessment' => [
        'endpoint' => env('TONGUE_API_URL'),
        'key'      => env('TONGUE_API_KEY'),
    ],

    // Brief #15 — Google OAuth login via Laravel Socialite. Patients
    // can register / sign in with one click. Backend exchanges the
    // OAuth callback for a Sanctum token via a one-time exchange code
    // (token never appears in URL). See AuthGoogleController.
    'google' => [
        'client_id'     => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect'      => env('GOOGLE_REDIRECT_URI'),
    ],

];
