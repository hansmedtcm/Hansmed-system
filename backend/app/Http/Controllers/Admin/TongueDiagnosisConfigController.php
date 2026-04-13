<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\TongueDiagnosis\KnowledgeBase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TongueDiagnosisConfigController extends Controller
{
    /** Get current tongue diagnosis configuration */
    public function index()
    {
        $configs = DB::table('system_configs')
            ->whereIn('config_key', [
                'tongue_api_url', 'tongue_api_key', 'tongue_api_provider',
                'tongue_report_header', 'tongue_report_footer',
                'tongue_report_disclaimer',
                'tongue_auto_recommendations', 'tongue_score_weights',
            ])
            ->pluck('config_value', 'config_key');

        return response()->json([
            'configs'       => $configs,
            'knowledge_base_summary' => [
                'tongue_colors'      => count(KnowledgeBase::TONGUE_COLORS),
                'tongue_coatings'    => count(KnowledgeBase::TONGUE_COATINGS),
                'tongue_shapes'      => count(KnowledgeBase::TONGUE_SHAPES),
                'moisture_types'     => count(KnowledgeBase::TONGUE_MOISTURE),
                'midline_patterns'   => count(KnowledgeBase::MIDLINE_PATTERNS),
                'constitution_types' => count(KnowledgeBase::CONSTITUTION_TYPES),
                'clinical_patterns'  => count(KnowledgeBase::CLINICAL_PATTERNS),
            ],
            'available_colors'   => array_keys(KnowledgeBase::TONGUE_COLORS),
            'available_coatings' => array_keys(KnowledgeBase::TONGUE_COATINGS),
            'available_shapes'   => array_keys(KnowledgeBase::TONGUE_SHAPES),
        ]);
    }

    /** Update tongue diagnosis configuration */
    public function update(Request $request)
    {
        $data = $request->validate([
            'tongue_api_url'              => ['nullable', 'string', 'max:500'],
            'tongue_api_key'              => ['nullable', 'string', 'max:500'],
            'tongue_api_provider'         => ['nullable', 'string', 'max:60'],
            'tongue_report_header'        => ['nullable', 'string', 'max:1000'],
            'tongue_report_footer'        => ['nullable', 'string', 'max:1000'],
            'tongue_report_disclaimer'    => ['nullable', 'string', 'max:2000'],
            'tongue_auto_recommendations' => ['nullable', 'in:true,false'],
            'tongue_score_weights'        => ['nullable', 'string', 'max:2000'],
        ]);

        foreach ($data as $key => $value) {
            if ($value !== null) {
                DB::table('system_configs')->updateOrInsert(
                    ['config_key' => $key],
                    ['config_value' => $value, 'updated_at' => now()]
                );
            }
        }

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'tongue_config.update',
            'target_type' => 'system_config',
            'payload'     => json_encode(array_keys($data)),
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Configuration updated']);
    }
}
