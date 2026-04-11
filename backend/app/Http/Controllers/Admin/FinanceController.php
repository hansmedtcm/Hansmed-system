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
    // M-08: platform-wide finance overview
    public function overview()
    {
        $paidAppointments = (float) Payment::where('status', 'succeeded')
            ->where('payable_type', 'appointment')->sum('amount');
        $paidOrders = (float) Payment::where('status', 'succeeded')
            ->where('payable_type', 'order')->sum('amount');

        return response()->json([
            'appointment_revenue' => $paidAppointments,
            'order_revenue'       => $paidOrders,
            'total_revenue'       => $paidAppointments + $paidOrders,
            'pending_withdrawals' => (float) Withdrawal::where('status', 'pending')->sum('amount'),
            'paid_withdrawals'    => (float) Withdrawal::whereIn('status', ['approved', 'paid'])->sum('amount'),
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
