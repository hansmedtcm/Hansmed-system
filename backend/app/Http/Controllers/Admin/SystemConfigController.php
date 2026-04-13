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
                DB::table('system_configs')->updateOrInsert(
                    ['config_key' => $key],
                    ['config_value' => is_scalar($value) ? (string) $value : json_encode($value), 'updated_at' => now()],
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
