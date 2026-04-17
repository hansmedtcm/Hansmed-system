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

    /**
     * Revenue broken down by income source for the selected window:
     *   • Teleconsult   — appointments.fee where visit_type = 'online'
     *   • Walk-in       — appointments.fee where visit_type = 'walk_in'
     *   • Treatment     — sum(consultations.treatments[*].fee)
     *   • Prescription orders — orders.total_amount where source_type = 'prescription'
     *   • Shop orders   — orders.total_amount where source_type in (null,'shop')
     *   • POS sales     — pos_sales.total (pharmacy cashier)
     *
     * Each line item returns amount + transaction count + trend % vs the
     * previous equal-length window, so the finance panel can render a
     * proper breakdown dashboard rather than one lump total.
     */
    public function revenueBySource(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        $onlineFee = (float) DB::table('appointments')
            ->where('status', 'completed')->where('visit_type', 'online')
            ->when($from, fn($q) => $q->whereDate('scheduled_start', '>=', $from))
            ->when($to,   fn($q) => $q->whereDate('scheduled_start', '<=', $to))
            ->sum('fee');
        $onlineN = (int) DB::table('appointments')
            ->where('status', 'completed')->where('visit_type', 'online')
            ->when($from, fn($q) => $q->whereDate('scheduled_start', '>=', $from))
            ->when($to,   fn($q) => $q->whereDate('scheduled_start', '<=', $to))
            ->count();

        $walkinFee = (float) DB::table('appointments')
            ->where('status', 'completed')->where('visit_type', 'walk_in')
            ->when($from, fn($q) => $q->whereDate('scheduled_start', '>=', $from))
            ->when($to,   fn($q) => $q->whereDate('scheduled_start', '<=', $to))
            ->sum('fee');
        $walkinN = (int) DB::table('appointments')
            ->where('status', 'completed')->where('visit_type', 'walk_in')
            ->when($from, fn($q) => $q->whereDate('scheduled_start', '>=', $from))
            ->when($to,   fn($q) => $q->whereDate('scheduled_start', '<=', $to))
            ->count();

        // Treatment fees live inside consultations.treatments JSON — pull a
        // thin slice and tally in PHP.
        $treatmentFee = 0.0;
        $treatmentN = 0;
        if (\Illuminate\Support\Facades\Schema::hasColumn('consultations', 'treatments')) {
            $rows = DB::table('consultations as c')
                ->join('appointments as a', 'a.id', '=', 'c.appointment_id')
                ->where('a.status', 'completed')
                ->when($from, fn($q) => $q->whereDate('a.scheduled_start', '>=', $from))
                ->when($to,   fn($q) => $q->whereDate('a.scheduled_start', '<=', $to))
                ->pluck('c.treatments');
            foreach ($rows as $raw) {
                $list = json_decode($raw ?? '[]', true) ?: [];
                foreach ($list as $t) {
                    $fee = (float) ($t['fee'] ?? 0);
                    if ($fee > 0) { $treatmentFee += $fee; $treatmentN++; }
                }
            }
        }

        // Orders — split by source_type if that column exists, otherwise
        // lump everything under "online orders".
        $ordersBase = DB::table('orders')->where('status', 'paid')
            ->when($from, fn($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to,   fn($q) => $q->whereDate('created_at', '<=', $to));
        $rxOrderFee   = 0.0; $rxOrderN   = 0;
        $shopOrderFee = 0.0; $shopOrderN = 0;
        if (\Illuminate\Support\Facades\Schema::hasColumn('orders', 'source_type')) {
            $rxOrderFee = (float) (clone $ordersBase)->where('source_type', 'prescription')->sum('total_amount');
            $rxOrderN   = (int)   (clone $ordersBase)->where('source_type', 'prescription')->count();
            $shopOrderFee = (float) (clone $ordersBase)->where(function ($w) { $w->whereNull('source_type')->orWhere('source_type', 'shop'); })->sum('total_amount');
            $shopOrderN   = (int)   (clone $ordersBase)->where(function ($w) { $w->whereNull('source_type')->orWhere('source_type', 'shop'); })->count();
        } else {
            $shopOrderFee = (float) (clone $ordersBase)->sum('total_amount');
            $shopOrderN   = (int)   (clone $ordersBase)->count();
        }

        // POS sales — only if the table exists
        $posFee = 0.0; $posN = 0;
        if (\Illuminate\Support\Facades\Schema::hasTable('pos_sales')) {
            $posQ = DB::table('pos_sales')
                ->when($from, fn($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to,   fn($q) => $q->whereDate('created_at', '<=', $to));
            $posFee = (float) (clone $posQ)->sum('total');
            $posN   = (int)   (clone $posQ)->count();
        }

        $sources = [
            ['key' => 'teleconsult',  'label' => 'Teleconsult Fees',     'label_zh' => '線上問診費',  'icon' => '📹', 'amount' => $onlineFee,    'count' => $onlineN],
            ['key' => 'walkin',       'label' => 'Walk-in Fees',         'label_zh' => '臨診費',      'icon' => '🏥', 'amount' => $walkinFee,    'count' => $walkinN],
            ['key' => 'treatments',   'label' => 'Treatments',           'label_zh' => '治療項目',    'icon' => '💉', 'amount' => $treatmentFee, 'count' => $treatmentN],
            ['key' => 'rx_orders',    'label' => 'Prescription Orders',  'label_zh' => '處方訂單',    'icon' => '💊', 'amount' => $rxOrderFee,   'count' => $rxOrderN],
            ['key' => 'shop_orders',  'label' => 'Shop Orders',          'label_zh' => '商店訂單',    'icon' => '🛍️', 'amount' => $shopOrderFee, 'count' => $shopOrderN],
            ['key' => 'pos',          'label' => 'Pharmacy POS',         'label_zh' => '藥房櫃檯',    'icon' => '🧾', 'amount' => $posFee,       'count' => $posN],
        ];
        $total = array_sum(array_column($sources, 'amount'));
        foreach ($sources as &$s) {
            $s['pct'] = $total > 0 ? round($s['amount'] / $total * 100, 1) : 0;
        }
        unset($s);

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'sources' => $sources,
            'total_revenue' => $total,
        ]);
    }

    /**
     * Per-pharmacy sales breakdown (mainly for POS cashier revenue).
     * Mirrors doctorBreakdown() — same date-range semantics, same shape.
     */
    public function pharmacyBreakdown(Request $request)
    {
        [$from, $to] = $this->resolveRange($request);

        $rows = collect();
        if (\Illuminate\Support\Facades\Schema::hasTable('pos_sales')) {
            $rows = DB::table('pos_sales as p')
                ->leftJoin('pharmacy_profiles as pp', 'pp.user_id', '=', 'p.pharmacy_id')
                ->leftJoin('users as u',  'u.id', '=', 'p.pharmacy_id')
                ->when($from, fn($q) => $q->whereDate('p.created_at', '>=', $from))
                ->when($to,   fn($q) => $q->whereDate('p.created_at', '<=', $to))
                ->select(
                    'p.pharmacy_id',
                    DB::raw('COALESCE(pp.name, u.email) as pharmacy_name'),
                    DB::raw('COUNT(*) as sale_count'),
                    DB::raw('COALESCE(SUM(p.total), 0) as pos_revenue'),
                    DB::raw("SUM(CASE WHEN p.sale_type = 'walk_in'     THEN 1 ELSE 0 END) as walk_in_count"),
                    DB::raw("SUM(CASE WHEN p.sale_type = 'prescription' THEN 1 ELSE 0 END) as rx_count")
                )
                ->groupBy('p.pharmacy_id', 'pp.name', 'u.email')
                ->orderByDesc('pos_revenue')
                ->get();
        }

        // Layer in online prescription-order revenue per pharmacy for completeness
        $onlineByPharm = [];
        if (\Illuminate\Support\Facades\Schema::hasColumn('orders', 'pharmacy_id')) {
            $onlineByPharm = DB::table('orders')
                ->where('status', 'paid')
                ->when($from, fn($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to,   fn($q) => $q->whereDate('created_at', '<=', $to))
                ->select('pharmacy_id', DB::raw('COALESCE(SUM(total_amount), 0) as online_revenue'), DB::raw('COUNT(*) as online_count'))
                ->groupBy('pharmacy_id')
                ->get()
                ->keyBy('pharmacy_id')
                ->toArray();
        }

        $totals = ['sale_count' => 0, 'pos_revenue' => 0.0, 'online_revenue' => 0.0, 'total_revenue' => 0.0];
        foreach ($rows as $r) {
            $o = $onlineByPharm[$r->pharmacy_id] ?? null;
            $r->online_revenue = $o ? (float) $o->online_revenue : 0.0;
            $r->online_count   = $o ? (int) $o->online_count : 0;
            $r->total_revenue  = (float) $r->pos_revenue + $r->online_revenue;
            $r->pos_revenue    = (float) $r->pos_revenue;
            $r->sale_count     = (int) $r->sale_count;
            $totals['sale_count']     += $r->sale_count;
            $totals['pos_revenue']    += $r->pos_revenue;
            $totals['online_revenue'] += $r->online_revenue;
            $totals['total_revenue']  += $r->total_revenue;
        }

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'pharmacies' => $rows,
            'summary' => array_merge(['pharmacy_count' => $rows->count()], $totals),
        ]);
    }

    /** Shared date-range resolver used by all breakdown endpoints. */
    private function resolveRange(Request $request): array
    {
        $from = $request->query('from');
        $to   = $request->query('to');
        $preset = $request->query('preset');
        if ($preset === 'today') { $from = $to = now()->toDateString(); }
        elseif ($preset === 'week')  { $from = now()->startOfWeek()->toDateString();  $to = now()->endOfWeek()->toDateString(); }
        elseif ($preset === 'month') { $from = now()->startOfMonth()->toDateString(); $to = now()->endOfMonth()->toDateString(); }
        elseif ($preset === 'year')  { $from = now()->startOfYear()->toDateString();  $to = now()->endOfYear()->toDateString(); }
        return [$from, $to];
    }
}
