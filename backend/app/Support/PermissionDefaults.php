<?php

namespace App\Support;

/**
 * Single source of truth for the in-code default permission matrix.
 *
 * Used by:
 *   - User::hasPermission() as the final fallback when the saved
 *     system_configs.role_permissions JSON doesn't list the key.
 *     Without this fallback, any permission added in code AFTER the
 *     admin first ran the permissions setup ends up returning false
 *     for non-admin roles — even though the code says it should be
 *     granted by default.
 *   - Admin\PermissionController for seeding the initial JSON when
 *     no system_configs row exists yet.
 *
 * Keep this list in sync with the role-permission UI under
 * /admin/#/permissions — adding a new key here makes it grant
 * immediately on production without requiring the admin to re-save.
 */
class PermissionDefaults
{
    /** Full default matrix. */
    public static function all(): array
    {
        return [
            'doctor' => [
                'view_appointments'    => true,
                'manage_appointments'  => true,
                'issue_prescriptions'  => true,
                'view_patient_records' => true,
                'video_consultation'   => true,
                'chat_with_patients'   => true,
                'view_earnings'        => true,
                'request_withdrawal'   => true,
                'manage_schedule'      => true,
                'issue_mc'             => true,
                'issue_referral'       => true,
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
                'manage_users'            => true,
                'manage_doctors'          => true,
                'manage_pharmacies'       => true,
                'manage_prescriptions'    => true,
                'manage_finance'          => true,
                'manage_configs'          => true,
                'manage_permissions'      => true,
                'view_audit_logs'         => true,
                'manage_content'          => true,
                'export_data'             => true,
                'tongue_diagnosis_config' => true,
            ],
        ];
    }

    /** Whether this role grants this permission by default in code. */
    public static function isGranted(string $role, string $key): bool
    {
        $all = self::all();
        return ! empty($all[$role][$key]);
    }
}
