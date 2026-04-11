<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * PayPal Orders v2 adapter. Uses the REST API directly.
 * config/services.php -> 'paypal' => [client_id, client_secret, mode]
 */
class PayPalClient
{
    public function createOrder(float $amount, string $currency, array $metadata = []): array
    {
        if (! $this->configured()) {
            // dev stub
            return [
                'id'           => 'PAYPAL_STUB_' . Str::upper(Str::random(12)),
                'status'       => 'CREATED',
                'approve_link' => 'https://sandbox.paypal.com/checkoutnow?token=STUB',
                'stub'         => true,
            ];
        }

        $res = Http::withToken($this->accessToken())
            ->post($this->base() . '/v2/checkout/orders', [
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'amount' => [
                        'currency_code' => strtoupper($currency),
                        'value'         => number_format($amount, 2, '.', ''),
                    ],
                    'custom_id' => json_encode($metadata),
                ]],
            ])->throw()->json();

        $approve = null;
        foreach ($res['links'] ?? [] as $l) {
            if (($l['rel'] ?? null) === 'approve') $approve = $l['href'];
        }

        return [
            'id'           => $res['id'] ?? null,
            'status'       => $res['status'] ?? null,
            'approve_link' => $approve,
            'raw'          => $res,
        ];
    }

    public function captureOrder(string $orderId): array
    {
        if (! $this->configured()) {
            return ['id' => $orderId, 'status' => 'COMPLETED', 'stub' => true];
        }
        return Http::withToken($this->accessToken())
            ->post($this->base() . "/v2/checkout/orders/{$orderId}/capture")
            ->throw()->json();
    }

    private function configured(): bool
    {
        return config('services.paypal.client_id') && config('services.paypal.client_secret');
    }

    private function base(): string
    {
        return config('services.paypal.mode') === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    private function accessToken(): string
    {
        return Cache::remember('paypal.token', 8 * 60, function () {
            $res = Http::asForm()
                ->withBasicAuth(
                    config('services.paypal.client_id'),
                    config('services.paypal.client_secret'),
                )
                ->post($this->base() . '/v1/oauth2/token', ['grant_type' => 'client_credentials'])
                ->throw()->json();
            return $res['access_token'];
        });
    }
}
