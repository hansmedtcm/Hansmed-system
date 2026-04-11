<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemConfigController extends Controller
{
    // M-09: key/value config (fees, thresholds, feature flags, terms URLs)
    public function index()
    {
        $rows = DB::table('system_configs')->orderBy('key')->get();
        $map  = [];
        foreach ($rows as $r) $map[$r->key] = $this->decode($r->value);
        return response()->json(['configs' => $map]);
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'configs' => ['required', 'array'],
        ]);

        DB::transaction(function () use ($data, $request) {
            foreach ($data['configs'] as $key => $value) {
                DB::table('system_configs')->updateOrInsert(
                    ['key' => $key],
                    ['value' => is_scalar($value) ? (string) $value : json_encode($value)],
                );
                DB::table('audit_logs')->insert([
                    'user_id'     => $request->user()->id,
                    'action'      => 'system_config.upsert',
                    'target_type' => 'system_config',
                    'payload'     => json_encode(['key' => $key, 'value' => $value]),
                    'created_at'  => now(),
                ]);
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
