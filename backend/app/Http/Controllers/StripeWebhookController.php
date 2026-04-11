<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Order;
use App\Models\Payment;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StripeWebhookController extends Controller
{
    public function __construct(private NotificationService $notifier) {}

    // POST /api/webhooks/stripe  (no auth)
    public function handle(Request $request)
    {
        if (! $this->verifySignature($request)) {
            Log::warning('stripe_webhook_bad_signature');
            return response()->json(['error' => 'invalid signature'], 400);
        }

        $event = $request->all();
        $type  = $event['type'] ?? null;
        $obj   = $event['data']['object'] ?? [];
        $intentId = $obj['id'] ?? null;

        if (! $intentId) {
            return response()->json(['ignored' => true]);
        }

        $payment = Payment::where('provider', 'stripe')
            ->where('provider_ref', $intentId)
            ->first();

        if (! $payment) {
            Log::warning('stripe_webhook_unknown_intent', ['id' => $intentId]);
            return response()->json(['ignored' => true]);
        }

        if ($type === 'payment_intent.succeeded') {
            $payment->update([
                'status'      => 'succeeded',
                'paid_at'     => now(),
                'raw_payload' => $obj,
            ]);

            if ($payment->payable_type === 'appointment') {
                $appt = Appointment::find($payment->payable_id);
                if ($appt && $appt->status === 'pending_payment') {
                    $appt->update(['status' => 'confirmed']);
                    $this->notifier->appointmentConfirmed($appt->patient_id, $appt->doctor_id, $appt->id);
                }
            } elseif ($payment->payable_type === 'order') {
                $order = Order::find($payment->payable_id);
                if ($order && $order->status === 'pending_payment') {
                    $order->update(['status' => 'paid', 'paid_at' => now()]);
                    $this->notifier->orderPaid($order->patient_id, $order->pharmacy_id, $order->id, $order->order_no);
                }
            }
        } elseif ($type === 'payment_intent.payment_failed') {
            $payment->update(['status' => 'failed', 'raw_payload' => $obj]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Verify the Stripe-Signature header per Stripe's docs:
     * https://stripe.com/docs/webhooks/signatures
     * In dev (no webhook_secret configured) we accept unsigned requests so the
     * local CLI can drive tests.
     */
    private function verifySignature(Request $request): bool
    {
        $secret = config('services.stripe.webhook_secret');
        if (! $secret) {
            return true; // dev mode
        }

        $header = $request->header('Stripe-Signature', '');
        if (! $header) return false;

        $parts = [];
        foreach (explode(',', $header) as $kv) {
            [$k, $v] = array_pad(explode('=', $kv, 2), 2, null);
            $parts[$k][] = $v;
        }
        $timestamp = $parts['t'][0] ?? null;
        $signatures = $parts['v1'] ?? [];
        if (! $timestamp || empty($signatures)) return false;

        // Reject events older than 5 minutes (replay protection)
        if (abs(time() - (int) $timestamp) > 300) return false;

        $payload = $timestamp . '.' . $request->getContent();
        $expected = hash_hmac('sha256', $payload, $secret);

        foreach ($signatures as $sig) {
            if (hash_equals($expected, $sig)) return true;
        }
        return false;
    }
}
