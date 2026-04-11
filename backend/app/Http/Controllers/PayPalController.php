<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Order;
use App\Models\Payment;
use App\Services\NotificationService;
use App\Services\PayPalClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayPalController extends Controller
{
    public function __construct(
        private PayPalClient $paypal,
        private NotificationService $notifier,
    ) {}

    // Create a PayPal order for an existing appointment OR order
    public function create(Request $request)
    {
        $data = $request->validate([
            'payable_type' => ['required', 'in:appointment,order'],
            'payable_id'   => ['required', 'integer'],
        ]);

        [$amount, $currency] = $this->resolveAmount($request->user()->id, $data['payable_type'], $data['payable_id']);

        $res = $this->paypal->createOrder($amount, $currency, [
            'payable_type' => $data['payable_type'],
            'payable_id'   => $data['payable_id'],
        ]);

        $payment = Payment::create([
            'user_id'      => $request->user()->id,
            'payable_type' => $data['payable_type'],
            'payable_id'   => $data['payable_id'],
            'provider'     => 'paypal',
            'provider_ref' => $res['id'] ?? null,
            'amount'       => $amount,
            'currency'     => $currency,
            'status'       => 'pending',
            'raw_payload'  => $res,
        ]);

        return response()->json([
            'payment'      => $payment,
            'paypal_order' => $res,
        ], 201);
    }

    // Patient returns from PayPal approval → capture funds
    public function capture(Request $request)
    {
        $data = $request->validate([
            'paypal_order_id' => ['required', 'string'],
        ]);

        $payment = Payment::where('provider', 'paypal')
            ->where('provider_ref', $data['paypal_order_id'])
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $result = $this->paypal->captureOrder($data['paypal_order_id']);

        return DB::transaction(function () use ($payment, $result) {
            if (($result['status'] ?? null) !== 'COMPLETED') {
                $payment->update(['status' => 'failed', 'raw_payload' => $result]);
                return response()->json(['message' => 'Capture failed', 'raw' => $result], 422);
            }

            $payment->update([
                'status'      => 'succeeded',
                'paid_at'     => now(),
                'raw_payload' => $result,
            ]);

            if ($payment->payable_type === 'appointment') {
                $appt = Appointment::find($payment->payable_id);
                if ($appt && $appt->status === 'pending_payment') {
                    $appt->update(['status' => 'confirmed']);
                    $this->notifier->appointmentConfirmed($appt->patient_id, $appt->doctor_id, $appt->id);
                }
            } else {
                $order = Order::find($payment->payable_id);
                if ($order && $order->status === 'pending_payment') {
                    $order->update(['status' => 'paid', 'paid_at' => now()]);
                    $this->notifier->orderPaid($order->patient_id, $order->pharmacy_id, $order->id, $order->order_no);
                }
            }

            return response()->json(['payment' => $payment->fresh()]);
        });
    }

    private function resolveAmount(int $userId, string $type, int $id): array
    {
        if ($type === 'appointment') {
            $appt = Appointment::where('patient_id', $userId)->findOrFail($id);
            if ($appt->status !== 'pending_payment') {
                throw ValidationException::withMessages(['payable_id' => 'Appointment not awaiting payment.']);
            }
            return [(float) $appt->fee, 'CNY'];
        }
        $order = Order::where('patient_id', $userId)->findOrFail($id);
        if ($order->status !== 'pending_payment') {
            throw ValidationException::withMessages(['payable_id' => 'Order not awaiting payment.']);
        }
        return [(float) $order->total, $order->currency];
    }
}
