<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Withdrawal;
use Illuminate\Http\Request;

class ReconciliationController extends Controller
{
    // P-09: daily / monthly revenue + settlement view
    public function summary(Request $request)
    {
        $pharmacyId = $request->user()->id;
        $period = $request->query('period', 'month'); // day | month | ytd
        $now = now();

        $q = Order::where('pharmacy_id', $pharmacyId)
            ->whereIn('status', ['paid', 'dispensing', 'dispensed', 'shipped', 'delivered', 'completed']);

        match ($period) {
            'day'   => $q->whereDate('paid_at', $now->toDateString()),
            'month' => $q->whereYear('paid_at', $now->year)->whereMonth('paid_at', $now->month),
            'ytd'   => $q->whereYear('paid_at', $now->year),
            default => null,
        };

        $orders = $q->get(['id', 'total', 'status', 'paid_at']);
        $gross = (float) $orders->sum('total');
        $count = $orders->count();

        // Platform fee for pharmacy orders (placeholder, move to config)
        $rate    = 0.08;
        $fee     = round($gross * $rate, 2);
        $net     = round($gross - $fee, 2);

        $withdrawn = (float) Withdrawal::where('user_id', $pharmacyId)
            ->whereIn('status', ['approved', 'paid'])->sum('amount');
        $pending = (float) Withdrawal::where('user_id', $pharmacyId)
            ->where('status', 'pending')->sum('amount');

        return response()->json([
            'period'             => $period,
            'order_count'        => $count,
            'gross_revenue'      => $gross,
            'platform_fee_rate'  => $rate,
            'platform_fee'       => $fee,
            'net_earnings'       => $net,
            'already_withdrawn'  => $withdrawn,
            'pending_withdrawal' => $pending,
            'available_balance'  => round($net - $withdrawn - $pending, 2),
        ]);
    }

    public function dailyBreakdown(Request $request)
    {
        $pharmacyId = $request->user()->id;
        $rows = Order::where('pharmacy_id', $pharmacyId)
            ->whereIn('status', ['paid', 'dispensing', 'dispensed', 'shipped', 'delivered', 'completed'])
            ->whereNotNull('paid_at')
            ->selectRaw('DATE(paid_at) as day, COUNT(*) as orders, SUM(total) as gross')
            ->groupBy('day')
            ->orderByDesc('day')
            ->limit(60)
            ->get();
        return response()->json(['days' => $rows]);
    }
}
