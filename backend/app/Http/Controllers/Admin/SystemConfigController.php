<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemConfigController extends Controller
{
    public function index()
    {
        $rows = DB::table('system_configs')->orderBy('config_key')->get();
        $map = [];
        foreach ($rows as $r) $map[$r->config_key] = $this->decode($r->config_value);
        return response()->json(['configs' => $map]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'configs' => ['required', 'array'],
        ]);

        DB::transaction(function () use ($data, $request) {
            foreach ($data['configs'] as $key => $value) {
                // Coerce null → '' BEFORE the scalar check. Without
                // this, JSON `null` from the frontend was hitting the
                // is_scalar() branch as false, then json_encode(null)
                // returned the literal string 'null', which got saved
                // and corrupted things like jitsi_domain (frontend
                // ended up building https://null/ as the iframe src).
                if ($value === null) {
                    $stored = '';
                } elseif (is_scalar($value)) {
                    $stored = (string) $value;
                } else {
                    $stored = json_encode($value);
                }
                DB::table('system_configs')->updateOrInsert(
                    ['config_key' => $key],
                    ['config_value' => $stored, 'updated_at' => now()],
                );
            }
        });

        return response()->json(['ok' => true]);
    }

    private function decode(string $raw)
    {
        $decoded = json_decode($raw, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $raw;
    }
}
