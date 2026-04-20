<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shared voucher logic — used by both the validate-only public
 * endpoint AND the actual order/appointment payment paths so the
 * rules don't drift between preview and apply.
 *
 * Returns shape:
 *   { ok: bool, message: string|null, voucher: {...}|null,
 *     discount_pct: float, discount_amount: float, total_after: float }
 */
class VoucherService
{
    public function lookup(string $code): ?object
    {
        if (! Schema::hasTable('vouchers')) return null;
        $row = DB::table('vouchers')
            ->whereRaw('LOWER(code) = ?', [strtolower(trim($code))])
            ->first();
        return $row ?: null;
    }

    /**
     * Validate the voucher against an amount + scope ('appointment' or
     * 'order') and return a result object the caller can act on.
     * Does NOT increment redemption_count — that happens in apply().
     */
    public function preview(string $code, float $amount, string $scope): array
    {
        $code = trim($code);
        if ($code === '') {
            return ['ok' => false, 'message' => 'Enter a voucher code.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        }
        $v = $this->lookup($code);
        if (! $v) {
            return ['ok' => false, 'message' => 'Invalid voucher code.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        }
        if (! $v->is_active) {
            return ['ok' => false, 'message' => 'This voucher is no longer active.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        }
        $today = now()->toDateString();
        if ($v->valid_from  && $today < $v->valid_from)   return ['ok' => false, 'message' => 'Voucher not valid yet.',     'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        if ($v->valid_until && $today > $v->valid_until)  return ['ok' => false, 'message' => 'Voucher has expired.',       'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        if ($v->max_redemptions && $v->redemption_count >= $v->max_redemptions) {
            return ['ok' => false, 'message' => 'Voucher fully redeemed.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        }
        if ($v->applies_to !== 'all' && $v->applies_to !== $scope) {
            return ['ok' => false, 'message' => 'Voucher not valid for this purchase type.', 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
        }

        $pct = (float) $v->discount_pct;
        $disc = round($amount * ($pct / 100), 2);
        $after = max(0, round($amount - $disc, 2));

        return [
            'ok'              => true,
            'message'         => 'Voucher applied: ' . $pct . '% off.',
            'voucher'         => $v,
            'discount_pct'    => $pct,
            'discount_amount' => $disc,
            'total_after'     => $after,
        ];
    }

    /** Increment redemption_count after a successful payment. */
    public function recordRedemption(int $voucherId): void
    {
        if (! Schema::hasTable('vouchers')) return;
        DB::table('vouchers')->where('id', $voucherId)
            ->update([
                'redemption_count' => DB::raw('redemption_count + 1'),
                'updated_at'       => now(),
            ]);
    }
}
