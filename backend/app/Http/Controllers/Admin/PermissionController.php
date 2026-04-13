<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PermissionController extends Controller
{
    /** Get current role permissions */
    public function index()
    {
        $raw = DB::table('system_configs')
            ->where('config_key', 'role_permissions')
            ->value('config_value');

        $permissions = $raw ? json_decode($raw, true) : $this->defaultPermissions();

        return response()->json(['permissions' => $permissions]);
    }

    /** Update role permissions */
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
            'action'      => 'permissions.update',
            'target_type' => 'system_config',
            'payload'     => json_encode($data['permissions']),
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Permissions updated']);
    }

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
