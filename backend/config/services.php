<?php

return [

    'stripe' => [
        'secret'         => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
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

    'tongue_diagnosis' => [
        'endpoint' => env('TONGUE_API_URL'),
        'key'      => env('TONGUE_API_KEY'),
    ],

];
