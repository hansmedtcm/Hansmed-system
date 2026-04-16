<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Withdrawal;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceController extends Controller
{
    // M-08: platform-wide finance overview, optionally scoped to a date range.
    public function overview(Request $request)
    {
        $from = $request->query('from'); // YYYY-MM-DD
        $to   = $request->query('to');

        $apptQ = Payment::where('status', 'succeeded')->where('payable_type', 'appointment');
        $ordQ  = Payment::where('status', 'succeeded')->where('payable_type', 'order');
        if ($from) { $apptQ->whereDate('created_at', '>=', $from); $ordQ->whereDate('created_at', '>=', $from); }
        if ($to)   { $apptQ->whereDate('created_at', '<=', $to);   $ordQ->whereDate('created_at', '<=', $to); }

        $paidAppointments = (float) $apptQ->sum('amount');
        $paidOrders       = (float) $ordQ->sum('amount');

        return response()->json([
            'appointment_revenue' => $paidAppointments,
            'order_revenue'       => $paidOrders,
            'total_revenue'       => $paidAppointments + $paidOrders,
            'pending_withdrawals' => (float) Withdrawal::where('status', 'pending')->sum('amount'),
            'paid_withdrawals'    => (float) Withdrawal::whereIn('status', ['approved', 'paid'])->sum('amount'),
            'range' => ['from' => $from, 'to' => $to],
        ]);
    }

    // M-08b: per-doctor revenue breakdown for a given date range.
    // Sums consultation fees + completed appointments + treatment fees logged
    // in consultations.treatments[].fee.
    public function doctorBreakdown(Request $request)
    {
        $from = $request->query('from');
        $to   = $request->query('to');
        $preset = $request->query('preset'); // today | week | month | year

        if ($preset === 'today') { $from = $to = now()->toDateString(); }
        elseif ($preset === 'week')  { $from = now()->startOfWeek()->toDateString();  $to = now()->endOfWeek()->toDateString(); }
        elseif ($preset === 'month') { $from = now()->startOfMonth()->toDateString(); $to = now()->endOfMonth()->toDateString(); }
        elseif ($preset === 'year')  { $from = now()->startOfYear()->toDateString();  $to = now()->endOfYear()->toDateString(); }

        // Build a base query for completed appointments in the window
        $apptQ = DB::table('appointments as a')
            ->leftJoin('doctor_profiles as dp', 'dp.user_id', '=', 'a.doctor_id')
            ->leftJoin('users as u',  'u.id', '=', 'a.doctor_id')
            ->whereNotNull('a.doctor_id')
            ->where('a.status', 'completed');
        if ($from) $apptQ->whereDate('a.scheduled_start', '>=', $from);
        if ($to)   $apptQ->whereDate('a.scheduled_start', '<=', $to);

        // Per-doctor consultation fee + visit count
        $rows = (clone $apptQ)
            ->select(
                'a.doctor_id',
                DB::raw('COALESCE(dp.full_name, u.email) as doctor_name'),
                DB::raw('COUNT(*) as visit_count'),
                DB::raw("SUM(CASE WHEN a.visit_type = 'walk_in' THEN 1 ELSE 0 END) as walk_in_count"),
                DB::raw("SUM(CASE WHEN a.visit_type = 'walk_in' THEN 0 ELSE 1 END) as online_count"),
                DB::raw('COALESCE(SUM(a.fee), 0) as consultation_revenue')
            )
            ->groupBy('a.doctor_id', 'dp.full_name', 'u.email')
            ->orderByDesc('consultation_revenue')
            ->get();

        // Now layer in treatment fees from consultations.treatments JSON.
        // We can't aggregate JSON server-side cleanly, so pull a small set and tally in PHP.
        $treatmentByDoctor = [];
        if (\Illuminate\Support\Facades\Schema::hasColumn('consultations', 'treatments')) {
            $consultRows = DB::table('consultations as c')
                ->join('appointments as a', 'a.id', '=', 'c.appointment_id')
                ->whereNotNull('a.doctor_id')
                ->where('a.status', 'completed')
                ->when($from, fn($q) => $q->whereDate('a.scheduled_start', '>=', $from))
                ->when($to,   fn($q) => $q->whereDate('a.scheduled_start', '<=', $to))
                ->select('a.doctor_id', 'c.treatments')
                ->get();
            foreach ($consultRows as $r) {
                $treatments = json_decode($r->treatments ?? '[]', true) ?: [];
                $sum = 0.0;
                foreach ($treatments as $t) {
                    $sum += (float) ($t['fee'] ?? 0);
                }
                if (! isset($treatmentByDoctor[$r->doctor_id])) $treatmentByDoctor[$r->doctor_id] = 0.0;
                $treatmentByDoctor[$r->doctor_id] += $sum;
            }
        }

        // Merge treatment totals into rows
        $totalConsultation = 0.0;
        $totalTreatment    = 0.0;
        $totalVisits       = 0;
        foreach ($rows as $r) {
            $r->treatment_revenue = (float) ($treatmentByDoctor[$r->doctor_id] ?? 0);
            $r->total_revenue     = (float) $r->consultation_revenue + $r->treatment_revenue;
            $r->visit_count       = (int) $r->visit_count;
            $totalConsultation   += (float) $r->consultation_revenue;
            $totalTreatment      += $r->treatment_revenue;
            $totalVisits         += (int) $r->visit_count;
        }

        return response()->json([
            'range'    => ['from' => $from, 'to' => $to, 'preset' => $preset],
            'doctors'  => $rows,
            'summary'  => [
                'doctor_count'         => count($rows),
                'visit_count'          => $totalVisits,
                'consultation_revenue' => $totalConsultation,
                'treatment_revenue'    => $totalTreatment,
                'total_revenue'        => $totalConsultation + $totalTreatment,
            ],
        ]);
    }

    public function pendingWithdrawals()
    {
        return response()->json(
            Withdrawal::where('status', 'pending')
                ->orderBy('created_at')
                ->paginate(30)
        );
    }

    public function reviewWithdrawal(Request $request, int $id, NotificationService $notifier)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject,paid'],
            'note'     => ['nullable', 'string', 'max:500'],
        ]);

        return DB::transaction(function () use ($id, $data, $request, $notifier) {
            $w = Withdrawal::where('status', 'pending')
                ->orWhere(fn($q) => $q->where('id', $id)->where('status', 'approved'))
                ->findOrFail($id);

            $w->update([
                'status'      => $data['decision'] === 'approve' ? 'approved' : $data['decision'],
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'withdrawal.' . $data['decision'],
                'target_type' => 'withdrawal',
                'target_id'   => $w->id,
                'payload'     => json_encode(['note' => $data['note'] ?? null]),
                'created_at'  => now(),
            ]);

            $notifier->withdrawalReviewed($w->user_id, $w->id, $data['decision']);

            return response()->json(['withdrawal' => $w->fresh()]);
        });
    }

    public function orders(Request $request)
    {
        $q = Order::query()->with('items');
        if ($s = $request->query('status'))  $q->where('status', $s);
        if ($p = $request->query('pharmacy_id')) $q->where('pharmacy_id', $p);
        return response()->json($q->orderByDesc('created_at')->paginate(30));
    }
}
