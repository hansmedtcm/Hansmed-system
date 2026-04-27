<?php

namespace App\Services;

use App\Services\TongueAssessment\AnalysisReport;
use App\Services\TongueAssessment\KnowledgeBase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Adapter for tongue wellness assessment (PDF E-60).
 *
 * Two modes:
 *  1. Third-party API: sends image to external provider, normalizes response.
 *  2. Dev stub: returns deterministic result using the KnowledgeBase.
 *
 * Both paths feed into AnalysisReport to produce a rich constitution report
 * grounded in the Yin's Modern Tongue Diagnosis (殷氏现代舌诊) framework.
 *
 * config/services.php:
 *   'tongue_assessment' => ['endpoint' => env('TONGUE_API_URL'), 'key' => env('TONGUE_API_KEY')],
 */
class TongueAssessmentClient
{
    public function __construct(private AnalysisReport $report) {}

    /**
     * Analyze a tongue image and return flat DB fields + rich constitution report.
     *
     * Routing:
     *   TONGUE_API_URL=anthropic  → route to Claude Vision (AnthropicTongueClient)
     *   TONGUE_API_URL=<https...>  → generic third-party endpoint (original code path)
     *   empty/unset              → deterministic dev stub (4 rotating fixtures)
     */
    public function analyze(string $imageUrl): array
    {
        // Resolve provider from admin UI override first, then env. The
        // admin UI writes to system_configs.tongue_api_url; that takes
        // precedence so the operator can switch providers without a
        // Railway redeploy.
        $endpoint = $this->resolveSetting('tongue_api_url')
                 ?? config('services.tongue_assessment.endpoint');
        $key      = $this->resolveSetting('tongue_api_key')
                 ?? config('services.tongue_assessment.key');

        // Short-circuit to Anthropic Claude Vision when configured.
        if (is_string($endpoint) && strtolower(trim($endpoint)) === 'anthropic') {
            return app(\App\Services\AnthropicTongueClient::class)->analyze($imageUrl);
        }

        if (! $endpoint) {
            return $this->stubResponse($imageUrl);
        }

        try {
            $res = Http::timeout(30)
                ->withHeaders(['Authorization' => 'Bearer ' . $key])
                ->post($endpoint, [
                    'image_url'       => $imageUrl,
                    'analysis_schema' => $this->analysisPromptSchema(),
                ])
                ->throw()
                ->json();
        } catch (\Throwable $e) {
            Log::error('tongue_assessment_failed', ['err' => $e->getMessage()]);
            return ['status' => 'failed', 'error' => $e->getMessage()];
        }

        return $this->map($res);
    }

    /**
     * Provide the diagnostic taxonomy to the AI/third-party so it classifies
     * using our exact enum values rather than free-form text.
     */
    public function analysisPromptSchema(): array
    {
        return [
            'tongue_color_options'  => array_keys(KnowledgeBase::TONGUE_COLORS),
            'coating_options'       => array_keys(KnowledgeBase::TONGUE_COATINGS),
            'shape_options'         => array_keys(KnowledgeBase::TONGUE_SHAPES),
            'moisture_options'      => array_keys(KnowledgeBase::TONGUE_MOISTURE),
            'midline_options'       => array_keys(KnowledgeBase::MIDLINE_PATTERNS),
            'holographic_map'       => KnowledgeBase::HOLOGRAPHIC_MAP,
            'three_burner_zones'    => KnowledgeBase::THREE_BURNER_ZONES,
        ];
    }

    /**
     * Read a setting from system_configs (admin UI overrides). Returns
     * null when the row doesn't exist, the value is empty, or the
     * table is missing — caller falls back to env / config in those
     * cases.
     */
    private function resolveSetting(string $key): ?string
    {
        try {
            $val = \Illuminate\Support\Facades\DB::table('system_configs')
                ->where('config_key', $key)
                ->value('config_value');
            return ! empty($val) ? (string) $val : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Normalize provider JSON -> our schema fields + generate report. */
    protected function map(array $res): array
    {
        $normalized = [
            'tongue_color' => $this->normalizeEnum($res['tongue_color'] ?? $res['color'] ?? null, array_keys(KnowledgeBase::TONGUE_COLORS)),
            'coating'      => $this->normalizeEnum($res['coating'] ?? $res['fur'] ?? null, array_keys(KnowledgeBase::TONGUE_COATINGS)),
            'shape'        => $this->normalizeEnum($res['shape'] ?? null, array_keys(KnowledgeBase::TONGUE_SHAPES)),
            'teeth_marks'  => (bool)($res['teeth_marks'] ?? false),
            'cracks'       => (bool)($res['cracks'] ?? false),
            'moisture'     => $this->normalizeEnum($res['moisture'] ?? null, array_keys(KnowledgeBase::TONGUE_MOISTURE)),
            'midline'      => $this->normalizeEnum($res['midline'] ?? null, array_keys(KnowledgeBase::MIDLINE_PATTERNS)),
        ];

        $report = $this->report->generate($normalized);

        return [
            'status'              => 'completed',
            'tongue_color'        => $normalized['tongue_color'],
            'coating'             => $normalized['coating'],
            'shape'               => $normalized['shape'],
            'teeth_marks'         => $normalized['teeth_marks'],
            'cracks'              => $normalized['cracks'],
            'moisture'            => $normalized['moisture'],
            'health_score'        => $report['health_score'],
            'constitution_report' => $report,
            'raw_response'        => $res,
        ];
    }

    /**
     * Dev stub with varied responses so the UI can exercise different states.
     * Rotates through 4 tongue patterns based on the image URL hash.
     */
    protected function stubResponse(string $imageUrl): array
    {
        $stubs = [
            [
                'tongue_color' => 'pale_red', 'coating' => 'thin_white', 'shape' => 'normal',
                'teeth_marks' => false, 'cracks' => false, 'moisture' => 'moist', 'midline' => 'centered',
            ],
            [
                'tongue_color' => 'red', 'coating' => 'yellow_greasy', 'shape' => 'normal',
                'teeth_marks' => false, 'cracks' => true, 'moisture' => 'dry', 'midline' => 'shifted_left',
            ],
            [
                'tongue_color' => 'pale_white', 'coating' => 'white_greasy', 'shape' => 'swollen',
                'teeth_marks' => true, 'cracks' => false, 'moisture' => 'slippery', 'midline' => 'shifted_right',
            ],
            [
                'tongue_color' => 'purple', 'coating' => 'grey_moist', 'shape' => 'teeth_marks',
                'teeth_marks' => true, 'cracks' => true, 'moisture' => 'moist', 'midline' => 'local_protrusion',
            ],
        ];

        $variant = crc32($imageUrl) % count($stubs);
        $raw = $stubs[$variant];

        $report = $this->report->generate($raw);

        return [
            'status'              => 'completed',
            'tongue_color'        => $raw['tongue_color'],
            'coating'             => $raw['coating'],
            'shape'               => $raw['shape'],
            'teeth_marks'         => $raw['teeth_marks'],
            'cracks'              => $raw['cracks'],
            'moisture'            => $raw['moisture'],
            'health_score'        => $report['health_score'],
            'constitution_report' => $report,
            'raw_response'        => ['stub' => true, 'variant' => $variant, 'image' => $imageUrl],
        ];
    }

    /** Safely coerce a provider string into one of our known enum values */
    private function normalizeEnum(?string $value, array $allowed): ?string
    {
        if ($value === null) return null;
        $clean = strtolower(trim($value));
        if (in_array($clean, $allowed, true)) return $clean;
        // Fuzzy: try replacing spaces/hyphens
        $clean = str_replace([' ', '-'], '_', $clean);
        if (in_array($clean, $allowed, true)) return $clean;
        return $allowed[0] ?? null; // safe default
    }
}

/* Class alias so anything still resolving the old name keeps working
 * for one release. Remove once all dispatched jobs and config refs
 * have been fully cycled through. */
class_alias(TongueAssessmentClient::class, 'App\Services\TongueDiagnosisClient');
