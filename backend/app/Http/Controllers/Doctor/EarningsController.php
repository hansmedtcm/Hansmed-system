<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Payment;
use App\Models\Withdrawal;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EarningsController extends Controller
{
    // Platform share of each consultation fee. Move to system_configs later.
    private const PLATFORM_FEE_RATE = 0.15;

    // D-11: income stats
    public function summary(Request $request)
    {
        $doctorId = $request->user()->id;

        $gross = (float) Payment::where('status', 'succeeded')
            ->where('payable_type', 'appointment')
            ->whereIn('payable_id', Appointment::where('doctor_id', $doctorId)->select('id'))
            ->sum('amount');

        $platformFee = round($gross * self::PLATFORM_FEE_RATE, 2);
        $net         = round($gross - $platformFee, 2);

        $withdrawn = (float) Withdrawal::where('user_id', $doctorId)
            ->whereIn('status', ['approved', 'paid'])
            ->sum('amount');

        $pending = (float) Withdrawal::where('user_id', $doctorId)
            ->where('status', 'pending')->sum('amount');

        return response()->json([
            'gross_revenue'      => $gross,
            'platform_fee_rate'  => self::PLATFORM_FEE_RATE,
            'platform_fee'       => $platformFee,
            'net_earnings'       => $net,
            'already_withdrawn'  => $withdrawn,
            'pending_withdrawal' => $pending,
            'available_balance'  => round($net - $withdrawn - $pending, 2),
        ]);
    }

    public function history(Request $request)
    {
        $doctorId = $request->user()->id;

        $rows = Payment::where('status', 'succeeded')
            ->where('payable_type', 'appointment')
            ->whereIn('payable_id', Appointment::where('doctor_id', $doctorId)->select('id'))
            ->orderByDesc('paid_at')
            ->paginate(30);

        return response()->json($rows);
    }

    // D-12: request withdrawal
    public function requestWithdrawal(Request $request, NotificationService $notifier)
    {
        $data = $request->validate([
            'amount'    => ['required', 'numeric', 'min:1'],
            'bank_info' => ['required', 'array'],
        ]);

        return DB::transaction(function () use ($request, $data) {
            $doctorId = $request->user()->id;

            // Recompute available inside the transaction
            $gross = (float) Payment::where('status', 'succeeded')
                ->where('payable_type', 'appointment')
                ->whereIn('payable_id', Appointment::where('doctor_id', $doctorId)->select('id'))
                ->sum('amount');
            $net = round($gross * (1 - self::PLATFORM_FEE_RATE), 2);
            $taken = (float) Withdrawal::where('user_id', $doctorId)
                ->whereIn('status', ['pending', 'approved', 'paid'])->sum('amount');
            $available = round($net - $taken, 2);

            if ($data['amount'] > $available) {
                throw ValidationException::withMessages([
                    'amount' => "Amount exceeds available balance ({$available}).",
                ]);
            }

            $w = Withdrawal::create([
                'user_id'   => $doctorId,
                'amount'    => $data['amount'],
                'currency'  => 'MYR',
                'status'    => 'pending',
                'bank_info' => $data['bank_info'],
            ]);

            return response()->json(['withdrawal' => $w], 201);
        });
    }

    public function withdrawals(Request $request)
    {
        return response()->json(
            Withdrawal::where('user_id', $request->user()->id)
                ->orderByDesc('created_at')->paginate(20)
        );
    }
}
