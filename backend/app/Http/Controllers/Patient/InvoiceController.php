<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Patient invoice endpoints. Works for both appointment and order
 * payments — the polymorphic payments table tells us which one it is.
 *
 * Patients only see invoices for payments they made themselves. The
 * response is deliberately structured for a simple printable HTML
 * viewer on the frontend — no PDF generation on the server, which
 * keeps the backend Docker image small and avoids extra dependencies
 * on Railway. Users print-to-PDF with Ctrl/Cmd+P from the viewer.
 */
class InvoiceController extends Controller
{
    /** List every paid invoice the current patient has. */
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $rows = Payment::where('user_id', $userId)
            ->where('status', 'succeeded')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $items = $rows->map(fn($p) => [
            'id'            => $p->id,
            'invoice_no'    => $this->invoiceNo($p),
            'payable_type'  => $p->payable_type,
            'payable_id'    => $p->payable_id,
            'amount'        => (float) $p->amount,
            'currency'      => $p->currency ?: 'MYR',
            'paid_at'       => $p->paid_at ?: $p->created_at,
            'provider'      => $p->provider,
            'provider_ref'  => $p->provider_ref,
        ]);

        return response()->json(['data' => $items]);
    }

    /** Full invoice detail for one payment id (patient's own only). */
    public function show(Request $request, int $id)
    {
        $userId = $request->user()->id;
        $payment = Payment::where('id', $id)->where('user_id', $userId)->firstOrFail();

        // Load the payee context so the invoice has proper line items
        $items = [];
        $subject = null;
        $doctorName = null;
        $pharmacyName = null;

        if ($payment->payable_type === 'appointment') {
            $appt = DB::table('appointments as a')
                ->leftJoin('doctor_profiles as dp', 'dp.user_id', '=', 'a.doctor_id')
                ->leftJoin('users as du', 'du.id', '=', 'a.doctor_id')
                ->where('a.id', $payment->payable_id)
                ->select('a.*', 'dp.full_name as doctor_name', 'du.email as doctor_email')
                ->first();
            if ($appt) {
                $doctorName = $appt->doctor_name ?: $appt->doctor_email;
                $subject = sprintf(
                    'Consultation with %s · %s',
                    $doctorName ?: 'doctor',
                    $appt->scheduled_start
                );
                $items[] = [
                    'description' => ($appt->visit_type === 'walk_in' ? 'Walk-in consultation' : 'Teleconsultation') .
                        ' — ' . ($doctorName ?: 'doctor'),
                    'description_zh' => $appt->visit_type === 'walk_in' ? '臨診問診費' : '線上問診費',
                    'quantity' => 1,
                    'unit_price' => (float) ($appt->fee ?: $payment->amount),
                    'line_total' => (float) ($appt->fee ?: $payment->amount),
                ];

                // Include any logged treatments for the consultation
                if (\Illuminate\Support\Facades\Schema::hasColumn('consultations', 'treatments')) {
                    $consult = DB::table('consultations')->where('appointment_id', $appt->id)->first();
                    if ($consult && $consult->treatments) {
                        $treatments = json_decode($consult->treatments, true) ?: [];
                        foreach ($treatments as $t) {
                            $fee = (float) ($t['fee'] ?? 0);
                            if ($fee > 0) {
                                $items[] = [
                                    'description' => ($t['icon'] ?? '•') . ' ' . ($t['name'] ?? 'Treatment'),
                                    'description_zh' => $t['name_zh'] ?? '治療',
                                    'quantity'   => 1,
                                    'unit_price' => $fee,
                                    'line_total' => $fee,
                                ];
                            }
                        }
                    }
                }
            }
        } elseif ($payment->payable_type === 'order') {
            $order = DB::table('orders as o')
                ->leftJoin('pharmacy_profiles as pp', 'pp.user_id', '=', 'o.pharmacy_id')
                ->where('o.id', $payment->payable_id)
                ->select('o.*', 'pp.name as pharmacy_name')
                ->first();
            if ($order) {
                $pharmacyName = $order->pharmacy_name ?: 'Pharmacy #' . $order->pharmacy_id;
                $subject = 'Order ' . ($order->order_no ?? ('#' . $order->id));

                $orderItems = DB::table('order_items')->where('order_id', $order->id)->get();
                foreach ($orderItems as $oi) {
                    $items[] = [
                        'description' => $oi->name ?? ('Item #' . $oi->id),
                        'description_zh' => $oi->specification ?? null,
                        'quantity'   => (float) $oi->quantity,
                        'unit_price' => (float) $oi->unit_price,
                        'line_total' => (float) $oi->line_total,
                    ];
                }
                if (empty($items)) {
                    // Fallback — order might not have line items row
                    $items[] = [
                        'description' => 'Pharmacy order',
                        'description_zh' => '藥房訂單',
                        'quantity'   => 1,
                        'unit_price' => (float) $payment->amount,
                        'line_total' => (float) $payment->amount,
                    ];
                }
            }
        }

        // Patient info for the bill-to block
        $patient = DB::table('users as u')
            ->leftJoin('patient_profiles as pp', 'pp.user_id', '=', 'u.id')
            ->where('u.id', $userId)
            ->select('u.email', 'pp.full_name', 'pp.nickname', 'pp.phone', 'pp.address_line1', 'pp.city', 'pp.state')
            ->first();

        $subtotal = array_sum(array_column($items, 'line_total'));

        return response()->json([
            'invoice' => [
                'invoice_no'   => $this->invoiceNo($payment),
                'issued_at'    => $payment->paid_at ?: $payment->created_at,
                'currency'     => $payment->currency ?: 'MYR',
                'subject'      => $subject,
                'payable_type' => $payment->payable_type,
                'payable_id'   => $payment->payable_id,

                'clinic' => [
                    'name'    => 'HansMed Modern TCM',
                    'address' => env('CLINIC_ADDRESS', ''),
                    'phone'   => env('CLINIC_PHONE', ''),
                    'email'   => env('CLINIC_EMAIL', ''),
                ],
                'provider'     => $payment->provider,
                'provider_ref' => $payment->provider_ref,

                'bill_to' => [
                    'name'    => $patient->full_name ?: $patient->nickname ?: $patient->email,
                    'email'   => $patient->email ?? null,
                    'phone'   => $patient->phone ?? null,
                    'address' => trim(($patient->address_line1 ?? '') . ' ' . ($patient->city ?? '') . ' ' . ($patient->state ?? '')) ?: null,
                ],
                'doctor_name'   => $doctorName,
                'pharmacy_name' => $pharmacyName,

                'items' => $items,
                'totals' => [
                    'subtotal' => $subtotal,
                    'tax'      => 0.0,
                    'total'    => (float) $payment->amount,
                ],
            ],
        ]);
    }

    private function invoiceNo(Payment $p): string
    {
        $d = ($p->paid_at ?: $p->created_at)->format('Ymd');
        return 'HM-' . $d . '-' . str_pad((string) $p->id, 5, '0', STR_PAD_LEFT);
    }
}
