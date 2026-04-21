<?php

/*
 |--------------------------------------------------------------------------
 | Payments — pilot-mode safety switch
 |--------------------------------------------------------------------------
 |
 | When `pilot_mode` is true, ALL payment provider calls (Stripe, PayPal,
 | etc.) are short-circuited to a local stub so no real money can move.
 | The frontend must display a "SIMULATED PAYMENT" banner whenever this
 | flag is true — see docs/ux/simulated-payment-banner.md.
 |
 | DEFAULT IS TRUE. This is deliberate: the only way to enable real
 | payments is to explicitly set PAYMENTS_PILOT_MODE=false in .env.
 | Don't flip this until the pilot-readiness checklist (docs/pilot-
 | readiness-checklist.md) is fully signed off AND the Bank Negara /
 | e-money / tax setup is in place.
 |
 | Even with pilot_mode=false, Stripe itself still respects its own
 | test vs live mode via the STRIPE_SECRET key you configure.
 |
 */

return [

    'pilot_mode' => env('PAYMENTS_PILOT_MODE', true),

    /*
     | Message attached to every stubbed payment response so it's obvious
     | in logs / dev tools that a real charge did NOT happen.
     */
    'stub_note' => 'SIMULATED PAYMENT — pilot_mode is on. No real charge was made.',

];
