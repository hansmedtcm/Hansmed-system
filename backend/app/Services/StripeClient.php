<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Minimal Stripe adapter (PDF E-62). Uses the Payment Intents REST API
 * directly so we don't hard-depend on stripe/stripe-php until billing
 * complexity actually demands it.
 *
 * config/services.php:
 *   'stripe' => ['secret' => env('STRIPE_SECRET'), 'webhook_secret' => env('STRIPE_WEBHOOK_SECRET')],
 *
 * PILOT-MODE SAFETY (added 2026-04-21):
 *   When config('payments.pilot_mode') is true, this client ALWAYS returns
 *   a stub — even if STRIPE_SECRET is set. This is a defence-in-depth
 *   guard so no real charges can occur during pilot. To enable real
 *   payments, set PAYMENTS_PILOT_MODE=false AND have the readiness
 *   checklist signed off. See config/payments.php.
 */
class StripeClient
{
    public function createPaymentIntent(int $amountMinor, string $currency, array $metadata = []): array
    {
        $pilotMode = (bool) config('payments.pilot_mode', true);
        $secret    = config('services.stripe.secret');

        if ($pilotMode || ! $secret) {
            // Log only when pilot_mode is forcing the stub despite a real
            // secret being present — that's a state worth knowing about.
            if ($pilotMode && $secret) {
                Log::info('StripeClient: pilot_mode is ON — stubbing payment intent even though STRIPE_SECRET is set.', [
                    'amount_minor' => $amountMinor,
                    'currency'     => $currency,
                ]);
            }

            return [
                'id'            => 'pi_test_' . Str::random(16),
                'client_secret' => 'pi_test_secret_' . Str::random(24),
                'status'        => 'requires_payment_method',
                'stub'          => true,
                'pilot_mode'    => $pilotMode,
                'note'          => config('payments.stub_note', 'SIMULATED PAYMENT — no real charge was made.'),
            ];
        }

        $payload = [
            'amount'   => $amountMinor,
            'currency' => strtolower($currency),
        ];
        foreach ($metadata as $k => $v) {
            $payload["metadata[$k]"] = $v;
        }

        return Http::asForm()
            ->withBasicAuth($secret, '')
            ->post('https://api.stripe.com/v1/payment_intents', $payload)
            ->throw()
            ->json();
    }
}
