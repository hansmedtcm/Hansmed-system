<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Minimal Stripe adapter (PDF E-62). Uses the Payment Intents REST API
 * directly so we don't hard-depend on stripe/stripe-php until billing
 * complexity actually demands it.
 *
 * config/services.php:
 *   'stripe' => ['secret' => env('STRIPE_SECRET'), 'webhook_secret' => env('STRIPE_WEBHOOK_SECRET')],
 */
class StripeClient
{
    public function createPaymentIntent(int $amountMinor, string $currency, array $metadata = []): array
    {
        $secret = config('services.stripe.secret');
        if (! $secret) {
            // dev stub
            return [
                'id'            => 'pi_test_' . Str::random(16),
                'client_secret' => 'pi_test_secret_' . Str::random(24),
                'status'        => 'requires_payment_method',
                'stub'          => true,
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
