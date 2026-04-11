<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    // M-13: dashboard metrics
    public function dashboard()
    {
        return response()->json([
            'users' => [
                'patients'   => User::where('role', 'patient')->count(),
                'doctors'    => User::where('role', 'doctor')->where('status', 'active')->count(),
                'pharmacies' => User::where('role', 'pharmacy')->where('status', 'active')->count(),
            ],
            'appointments' => [
                'total'     => Appointment::count(),
                'completed' => Appointment::where('status', 'completed')->count(),
                'today'     => Appointment::whereDate('scheduled_start', now()->toDateString())->count(),
            ],
            'orders' => [
                'total'   => Order::count(),
                'paid'    => Order::whereNotNull('paid_at')->count(),
                'revenue' => (float) Order::whereNotNull('paid_at')->sum('total'),
            ],
            'payments_last_30d' => (float) Payment::where('status', 'succeeded')
                ->where('paid_at', '>=', now()->subDays(30))->sum('amount'),
        ]);
    }

    // M-13: CSV export (orders | appointments | payments)
    public function exportCsv(Request $request, string $entity): StreamedResponse
    {
        abort_unless(in_array($entity, ['orders', 'appointments', 'payments'], true), 404);

        $filename = "{$entity}-" . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($entity) {
            $out = fopen('php://output', 'w');

            if ($entity === 'orders') {
                fputcsv($out, ['id', 'order_no', 'patient_id', 'pharmacy_id', 'status', 'subtotal', 'total', 'paid_at', 'created_at']);
                Order::orderBy('id')->chunk(500, function ($chunk) use ($out) {
                    foreach ($chunk as $o) {
                        fputcsv($out, [$o->id, $o->order_no, $o->patient_id, $o->pharmacy_id, $o->status, $o->subtotal, $o->total, $o->paid_at, $o->created_at]);
                    }
                });
            } elseif ($entity === 'appointments') {
                fputcsv($out, ['id', 'patient_id', 'doctor_id', 'status', 'fee', 'scheduled_start', 'created_at']);
                Appointment::orderBy('id')->chunk(500, function ($chunk) use ($out) {
                    foreach ($chunk as $a) {
                        fputcsv($out, [$a->id, $a->patient_id, $a->doctor_id, $a->status, $a->fee, $a->scheduled_start, $a->created_at]);
                    }
                });
            } else {
                fputcsv($out, ['id', 'user_id', 'payable_type', 'payable_id', 'provider', 'amount', 'currency', 'status', 'paid_at']);
                Payment::orderBy('id')->chunk(500, function ($chunk) use ($out) {
                    foreach ($chunk as $p) {
                        fputcsv($out, [$p->id, $p->user_id, $p->payable_type, $p->payable_id, $p->provider, $p->amount, $p->currency, $p->status, $p->paid_at]);
                    }
                });
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}
