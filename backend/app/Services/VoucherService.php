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
     * Does NOT increment redemption_count — that happens in
     * recordRedemption() after the payment commits.
     *
     * Brief #16: $userId optional. When provided AND the voucher has a
     * per_user_limit set, also rejects if this user has already hit
     * their personal cap. Allows shared promo codes (e.g. TESTER2026MAY)
     * to be one-use-per-tester rather than one-use-total.
     */
    public function preview(string $code, float $amount, string $scope, ?int $userId = null): array
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

        // Brief #16: per-user limit check. Only applies when caller
        // supplied a $userId AND the voucher row has a non-null
        // per_user_limit (NULL = no per-person cap, legacy behaviour).
        // Skips silently when the redemptions table doesn't exist yet
        // (pre-migration) so the rest of the validation still works.
        $perUserLimit = isset($v->per_user_limit) ? $v->per_user_limit : null;
        if ($userId && $perUserLimit !== null && Schema::hasTable('voucher_redemptions')) {
            $userRedemptions = DB::table('voucher_redemptions')
                ->where('voucher_id', $v->id)
                ->where('user_id', $userId)
                ->count();
            if ($userRedemptions >= (int) $perUserLimit) {
                $msg = ((int) $perUserLimit === 1)
                    ? 'You have already used this voucher.'
                    : 'You have reached the use limit for this voucher (' . (int) $perUserLimit . ' uses).';
                return ['ok' => false, 'message' => $msg, 'discount_pct' => 0, 'discount_amount' => 0, 'total_after' => $amount];
            }
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

    /**
     * Atomically record a voucher redemption.
     *
     * Brief #16 — race-condition safe. Inserts a row in
     * voucher_redemptions AND increments the total counter in
     * vouchers.redemption_count, all within a single DB transaction
     * with row locks. Re-checks total cap and per-user cap inside
     * the transaction to prevent two concurrent requests both
     * passing the preview check before either has saved.
     *
     * Backward-compat: the old signature was recordRedemption(int).
     * The new signature takes the full context (user, ref, discount).
     * If the voucher_redemptions table doesn't exist yet (pre-
     * migration deploy window) this still increments the legacy
     * counter so charging doesn't break.
     *
     * @return array { ok: bool, message: string }
     */
    public function recordRedemption(int $voucherId, ?int $userId = null, ?string $refType = null, ?int $refId = null, float $discountAmount = 0): array
    {
        if (! Schema::hasTable('vouchers')) {
            return ['ok' => false, 'message' => 'Voucher tables missing.'];
        }

        // Pre-migration fallback — no redemptions table yet, just
        // bump the legacy counter so existing flow keeps working.
        if (! Schema::hasTable('voucher_redemptions')) {
            DB::table('vouchers')->where('id', $voucherId)
                ->update([
                    'redemption_count' => DB::raw('redemption_count + 1'),
                    'updated_at'       => now(),
                ]);
            return ['ok' => true, 'message' => 'Redemption recorded (legacy counter only — voucher_redemptions table not yet present).'];
        }

        return DB::transaction(function () use ($voucherId, $userId, $refType, $refId, $discountAmount) {
            // Re-fetch with row lock so concurrent requests serialise
            // through the cap checks.
            $v = DB::table('vouchers')->where('id', $voucherId)->lockForUpdate()->first();
            if (! $v) {
                return ['ok' => false, 'message' => 'Voucher not found.'];
            }

            // Re-check total cap (in case other requests redeemed
            // concurrently between preview and apply).
            if ($v->max_redemptions && $v->redemption_count >= $v->max_redemptions) {
                return ['ok' => false, 'message' => 'Voucher fully redeemed.'];
            }

            // Re-check per-user cap. Only when userId supplied AND
            // voucher carries a non-null per_user_limit.
            $perUserLimit = isset($v->per_user_limit) ? $v->per_user_limit : null;
            if ($userId && $perUserLimit !== null) {
                $userCount = DB::table('voucher_redemptions')
                    ->where('voucher_id', $voucherId)
                    ->where('user_id', $userId)
                    ->lockForUpdate()
                    ->count();
                if ($userCount >= (int) $perUserLimit) {
                    $msg = ((int) $perUserLimit === 1)
                        ? 'You have already used this voucher.'
                        : 'You have reached the use limit for this voucher.';
                    return ['ok' => false, 'message' => $msg];
                }
            }

            // Insert per-user redemption row when we have a user; if
            // the caller is system-driven (legacy path with no user
            // id), skip the insert and just bump the counter.
            if ($userId) {
                DB::table('voucher_redemptions')->insert([
                    'voucher_id'      => $voucherId,
                    'user_id'         => $userId,
                    'ref_type'        => $refType,
                    'ref_id'          => $refId,
                    'discount_amount' => $discountAmount,
                    'redeemed_at'     => now(),
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
            }

            DB::table('vouchers')->where('id', $voucherId)
                ->update([
                    'redemption_count' => DB::raw('redemption_count + 1'),
                    'updated_at'       => now(),
                ]);

            return ['ok' => true, 'message' => 'Redemption recorded.'];
        });
    }
}
