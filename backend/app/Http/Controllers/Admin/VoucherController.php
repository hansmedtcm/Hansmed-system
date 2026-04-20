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
        if (Schema::hasTable('vouchers')) return;
        DB::statement("
            CREATE TABLE vouchers (
                id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                code             VARCHAR(40) NOT NULL UNIQUE,
                description      VARCHAR(255) NULL,
                discount_pct     DECIMAL(5,2) NOT NULL,
                max_redemptions  INT UNSIGNED NULL,
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
            'valid_from'      => ['nullable', 'date'],
            'valid_until'     => ['nullable', 'date'],
            'applies_to'      => ['nullable', 'in:all,appointment,order'],
            'is_active'       => ['nullable', 'boolean'],
        ]);

        $code = strtoupper(trim($data['code']));
        if (DB::table('vouchers')->where('code', $code)->exists()) {
            return response()->json(['message' => 'Code already exists.'], 422);
        }

        $id = DB::table('vouchers')->insertGetId([
            'code'            => $code,
            'description'     => $data['description'] ?? null,
            'discount_pct'    => $data['discount_pct'],
            'max_redemptions' => $data['max_redemptions'] ?? null,
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
}
