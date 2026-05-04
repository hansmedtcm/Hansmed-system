<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin CRUD for discount vouchers / promo codes.
 *
 * Vouchers are simple percentage-discount codes the admin creates and
 * shares with patients (broadcast email, posters, in-clinic). The
 * patient enters the code at payment time on either the appointment
 * booking flow or the medicine-order flow; the backend validates +
 * applies the discount and increments the redemption count.
 *
 * Schema (auto-created on first call):
 *   id              PK
 *   code            VARCHAR(40), unique, uppercase
 *   description     short label admin uses to remember the campaign
 *   discount_pct    0–100 (0 not allowed)
 *   max_redemptions NULL = unlimited
 *   redemption_count tracked
 *   valid_from      nullable date
 *   valid_until     nullable date
 *   applies_to      'all' | 'appointment' | 'order'
 *   is_active       0/1
 *   created_at, updated_at
 */
class VoucherController extends Controller
{
    private function ensureTable(): void
    {
        if (! Schema::hasTable('vouchers')) {
            DB::statement("
                CREATE TABLE vouchers (
                    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    code             VARCHAR(40) NOT NULL UNIQUE,
                    description      VARCHAR(255) NULL,
                    discount_pct     DECIMAL(5,2) NOT NULL,
                    max_redemptions  INT UNSIGNED NULL,
                    per_user_limit   SMALLINT UNSIGNED NULL DEFAULT 1,
                    redemption_count INT UNSIGNED NOT NULL DEFAULT 0,
                    valid_from       DATE NULL,
                    valid_until      DATE NULL,
                    applies_to       ENUM('all','appointment','order') NOT NULL DEFAULT 'all',
                    is_active        TINYINT(1) NOT NULL DEFAULT 1,
                    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_v_code (code),
                    INDEX idx_v_active (is_active, valid_until)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } else if (! Schema::hasColumn('vouchers', 'per_user_limit')) {
            // Brief #16: add the column on existing installs that
            // pre-date the manual SQL migration. Default 1 means each
            // user can redeem any voucher exactly once unless the
            // admin edits the voucher to raise or remove the cap.
            DB::statement("ALTER TABLE vouchers ADD COLUMN per_user_limit SMALLINT UNSIGNED NULL DEFAULT 1 AFTER max_redemptions");
        }

        // Brief #16: voucher_redemptions table — source of truth for
        // per-user redemption tracking + admin "Used by" view.
        if (! Schema::hasTable('voucher_redemptions')) {
            DB::statement("
                CREATE TABLE voucher_redemptions (
                    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    voucher_id      BIGINT UNSIGNED NOT NULL,
                    user_id         BIGINT UNSIGNED NOT NULL,
                    ref_type        VARCHAR(32) NULL,
                    ref_id          BIGINT UNSIGNED NULL,
                    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
                    redeemed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_vr_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
                    CONSTRAINT fk_vr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
                    INDEX idx_vr_voucher_user (voucher_id, user_id),
                    INDEX idx_vr_voucher_when (voucher_id, redeemed_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        }
    }

    public function index(Request $request)
    {
        $this->ensureTable();
        $rows = DB::table('vouchers')->orderByDesc('id')->get();
        return response()->json(['data' => $rows]);
    }

    public function store(Request $request)
    {
        $this->ensureTable();
        $data = $request->validate([
            'code'            => ['required', 'string', 'max:40'],
            'description'     => ['nullable', 'string', 'max:255'],
            'discount_pct'    => ['required', 'numeric', 'min:0.01', 'max:100'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            // Brief #16: per-user limit. Default 1 if omitted; null
            // explicitly = no cap (unlimited per person).
            'per_user_limit'  => ['nullable', 'integer', 'min:1'],
            'valid_from'      => ['nullable', 'date'],
            'valid_until'     => ['nullable', 'date'],
            'applies_to'      => ['nullable', 'in:all,appointment,order'],
            'is_active'       => ['nullable', 'boolean'],
        ]);

        $code = strtoupper(trim($data['code']));
        if (DB::table('vouchers')->where('code', $code)->exists()) {
            return response()->json(['message' => 'Code already exists.'], 422);
        }

        // per_user_limit: default to 1 when omitted; allow explicit
        // null (passed as null in JSON) to mean unlimited.
        $perUserLimit = array_key_exists('per_user_limit', $data) ? $data['per_user_limit'] : 1;

        $id = DB::table('vouchers')->insertGetId([
            'code'            => $code,
            'description'     => $data['description'] ?? null,
            'discount_pct'    => $data['discount_pct'],
            'max_redemptions' => $data['max_redemptions'] ?? null,
            'per_user_limit'  => $perUserLimit,
            'valid_from'      => $data['valid_from']     ?? null,
            'valid_until'     => $data['valid_until']    ?? null,
            'applies_to'      => $data['applies_to']     ?? 'all',
            'is_active'       => isset($data['is_active']) ? (int) $data['is_active'] : 1,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        return response()->json(['voucher' => DB::table('vouchers')->find($id)], 201);
    }

    public function update(Request $request, int $id)
    {
        $this->ensureTable();
        $data = $request->validate([
            'description'     => ['nullable', 'string', 'max:255'],
            'discount_pct'    => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            'max_redemptions' => ['nullable', 'integer', 'min:1'],
            // Brief #16: per-user limit can be edited; passing null
            // explicitly removes the cap, omitting the key leaves
            // the existing value untouched.
            'per_user_limit'  => ['nullable', 'integer', 'min:1'],
            'valid_from'      => ['nullable', 'date'],
            'valid_until'     => ['nullable', 'date'],
            'applies_to'      => ['nullable', 'in:all,appointment,order'],
            'is_active'       => ['nullable', 'boolean'],
        ]);
        $data['updated_at'] = now();
        $affected = DB::table('vouchers')->where('id', $id)->update($data);
        if (! $affected && ! DB::table('vouchers')->where('id', $id)->exists()) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['voucher' => DB::table('vouchers')->find($id)]);
    }

    public function destroy(int $id)
    {
        $this->ensureTable();
        DB::table('vouchers')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * Brief #16 — GET /api/admin/vouchers/{id}/redemptions
     *
     * List every redemption of a voucher with the user's name + email
     * and the reference (order/appointment id) the discount applied to.
     * Used by the admin "Used by" modal in the voucher list.
     *
     * Returns an empty array (not 404) for vouchers that exist but
     * have never been redeemed — the admin UI distinguishes "no
     * redemptions yet" from "voucher missing".
     *
     * Notes on the user join: the users table here uses `name` for
     * the display name (Laravel default). If the local schema uses
     * a different column (e.g. `full_name` on patient_profiles),
     * the COALESCE below falls back so this endpoint still returns
     * something readable.
     */
    public function listRedemptions(int $id)
    {
        $this->ensureTable();

        if (! Schema::hasTable('voucher_redemptions')) {
            return response()->json(['data' => []]);
        }

        $rows = DB::table('voucher_redemptions as vr')
            ->leftJoin('users as u', 'u.id', '=', 'vr.user_id')
            ->where('vr.voucher_id', $id)
            ->orderByDesc('vr.redeemed_at')
            ->select(
                'vr.id',
                'vr.user_id',
                'vr.ref_type',
                'vr.ref_id',
                'vr.discount_amount',
                'vr.redeemed_at',
                'u.name  as user_name',
                'u.email as user_email'
            )
            ->get();

        return response()->json(['data' => $rows]);
    }
}
