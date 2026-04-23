<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PermissionController extends Controller
{
    /* ==================================================================
       ROLE-LEVEL DEFAULTS
       Stored as a single JSON blob in system_configs.role_permissions.
       Every user in a role inherits these unless overridden per-user.
       ================================================================== */

    /** Get current role permissions (with defaults if not yet configured) */
    public function index()
    {
        $raw = DB::table('system_configs')
            ->where('config_key', 'role_permissions')
            ->value('config_value');

        $permissions = $raw ? json_decode($raw, true) : $this->defaultPermissions();

        return response()->json(['permissions' => $permissions]);
    }

    /** Update role permissions (role defaults for everyone in that role) */
    public function update(Request $request)
    {
        $data = $request->validate([
            'permissions' => ['required', 'array'],
        ]);

        DB::table('system_configs')->updateOrInsert(
            ['config_key' => 'role_permissions'],
            ['config_value' => json_encode($data['permissions']), 'updated_at' => now()]
        );

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'permissions.update_role',
            'target_type' => 'system_config',
            'payload'     => json_encode($data['permissions']),
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Role permissions updated']);
    }

    /* ==================================================================
       PER-USER OVERRIDES
       Stored as rows in user_permission_overrides. An override row takes
       priority over the role default — use granted=1 to force-allow and
       granted=0 to force-deny. Delete the row to revert to role default.
       ================================================================== */

    /** Show effective permissions for one user + which keys are overridden */
    public function showForUser(int $id)
    {
        $user = DB::table('users')->where('id', $id)->first();
        if (! $user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $raw = DB::table('system_configs')
            ->where('config_key', 'role_permissions')
            ->value('config_value');
        $roleMap = $raw ? (json_decode($raw, true) ?: []) : $this->defaultPermissions();
        $roleDefaults = $roleMap[$user->role] ?? [];

        $overridesMap = [];
        try {
            $overrides = DB::table('user_permission_overrides')
                ->where('user_id', $id)
                ->get(['permission_key', 'granted']);
            foreach ($overrides as $o) {
                $overridesMap[$o->permission_key] = (bool) $o->granted;
            }
        } catch (\Throwable $e) {
            /* Table missing — migration not run yet. Return empty overrides
               so the frontend still shows the role defaults; the admin can
               hit "Run migration" and try again. */
        }

        /* Merge: start from role defaults, apply overrides on top */
        $effective = $roleDefaults;
        foreach ($overridesMap as $k => $v) {
            $effective[$k] = $v;
        }

        $isMaster = in_array(strtolower((string) $user->email), \App\Models\User::masterEmails(), true);

        return response()->json([
            'user_id'       => (int) $user->id,
            'email'         => $user->email,
            'role'          => $user->role,
            'is_master'     => $isMaster,
            'role_defaults' => $roleDefaults,
            'overrides'     => $overridesMap,
            'effective'     => $effective,
            'all_keys'      => array_keys($this->defaultPermissions()[$user->role] ?? []),
        ]);
    }

    /**
     * Update per-user overrides. Expects:
     *   {
     *     "overrides": {
     *       "view_earnings":   true,    // force allow
     *       "manage_finance":  false,   // force deny
     *       "request_withdrawal": null  // revert to role default (deletes row)
     *     }
     *   }
     */
    public function updateForUser(Request $request, int $id)
    {
        $user = DB::table('users')->where('id', $id)->first();
        if (! $user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        /* Master accounts have full bypass in hasPermission(); block any
           override writes against them so the UI can't mislead (saving
           an override would have no runtime effect anyway). */
        $masterEmails = \App\Models\User::masterEmails();
        if (in_array(strtolower((string) $user->email), $masterEmails, true)) {
            return response()->json([
                'message' => 'Master account permissions cannot be overridden. This account has full permanent access.',
            ], 422);
        }

        $data = $request->validate([
            'overrides' => ['required', 'array'],
        ]);

        $now = now();
        $applied = [];
        foreach ($data['overrides'] as $key => $value) {
            /* Validate key format — alphanumeric + underscore only */
            if (! preg_match('/^[a-z0-9_]+$/i', $key)) continue;

            if ($value === null) {
                /* null → revert to role default, delete any existing row */
                DB::table('user_permission_overrides')
                    ->where('user_id', $id)
                    ->where('permission_key', $key)
                    ->delete();
                $applied[$key] = 'default';
                continue;
            }

            $granted = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($granted === null) continue;

            DB::table('user_permission_overrides')->updateOrInsert(
                ['user_id' => $id, 'permission_key' => $key],
                ['granted' => $granted ? 1 : 0, 'updated_at' => $now, 'created_at' => $now]
            );
            $applied[$key] = $granted ? 'allow' : 'deny';
        }

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'permissions.update_user',
            'target_type' => 'user',
            'target_id'   => $id,
            'payload'     => json_encode(['applied' => $applied]),
            'created_at'  => $now,
        ]);

        return response()->json(['message' => 'User permissions updated', 'applied' => $applied]);
    }

    /* ==================================================================
       SCHEMA MIGRATION (idempotent — safe to hit multiple times)
       Creates user_permission_overrides on existing installations where
       schema.sql was already imported without it.
       ================================================================== */

    public function migrate()
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS user_permission_overrides (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                permission_key VARCHAR(64) NOT NULL,
                granted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NULL DEFAULT NULL,
                updated_at TIMESTAMP NULL DEFAULT NULL,
                UNIQUE KEY uniq_user_permission (user_id, permission_key),
                KEY idx_user (user_id),
                CONSTRAINT fk_upo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        return response()->json([
            'ok' => true,
            'table' => 'user_permission_overrides',
            'message' => 'Migration applied. Per-user permission overrides are ready.',
        ]);
    }

    /* ==================================================================
       DEFAULT PERMISSION KEYS (used when no system_config row exists yet)
       ================================================================== */

    private function defaultPermissions(): array
    {
        return [
            'doctor' => [
                'view_appointments'   => true,
                'manage_appointments' => true,
                'issue_prescriptions' => true,
                'view_patient_records'=> true,
                'video_consultation'  => true,
                'chat_with_patients'  => true,
                'view_earnings'       => true,
                'request_withdrawal'  => true,
                'manage_schedule'     => true,
                'issue_mc'            => true,
                'issue_referral'      => true,
            ],
            'pharmacy' => [
                'manage_products'     => true,
                'manage_inventory'    => true,
                'view_orders'         => true,
                'dispense_orders'     => true,
                'ship_orders'         => true,
                'use_pos'             => true,
                'view_reconciliation' => true,
            ],
            'admin' => [
                'manage_users'        => true,
                'manage_doctors'      => true,
                'manage_pharmacies'   => true,
                'manage_prescriptions'=> true,
                'manage_finance'      => true,
                'manage_configs'      => true,
                'manage_permissions'  => true,
                'view_audit_logs'     => true,
                'manage_content'      => true,
                'export_data'         => true,
                'tongue_diagnosis_config' => true,
            ],
        ];
    }
}
