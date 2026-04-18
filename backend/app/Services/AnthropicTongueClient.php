<?php

namespace App\Services;

use App\Services\TongueDiagnosis\AnalysisReport;
use App\Services\TongueDiagnosis\KnowledgeBase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Anthropic Claude Vision adapter for tongue diagnosis.
 *
 * Downloads the patient's tongue image, sends it to Claude with a
 * structured-output prompt forcing classification into the KnowledgeBase
 * enum values, parses the JSON reply, and feeds the normalised fields
 * into AnalysisReport to produce the full constitution report.
 *
 * Activated when TONGUE_API_URL=anthropic (case-insensitive).
 * Requires TONGUE_API_KEY=sk-ant-api03-... set on Railway.
 *
 * Optional env vars:
 *   TONGUE_API_MODEL   — defaults to claude-sonnet-4-5
 *   TONGUE_API_TIMEOUT — seconds to wait, default 45
 */
class AnthropicTongueClient
{
    private const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
    private const DEFAULT_MODEL = 'claude-sonnet-4-5';

    public function __construct(private AnalysisReport $report) {}

    /**
     * Analyze a tongue image via Claude Vision. Returns the same shape as
     * TongueDiagnosisClient::map() so the existing controller code works
     * without any changes.
     */
    public function analyze(string $imageUrl): array
    {
        $key = config('services.tongue_diagnosis.key');
        if (empty($key)) {
            return ['status' => 'failed', 'error' => 'TONGUE_API_KEY is not set'];
        }

        // Fetch the image and convert to base64 for the multimodal payload.
        $imageData = $this->fetchImage($imageUrl);
        if (! $imageData) {
            return ['status' => 'failed', 'error' => 'Could not fetch tongue image from storage'];
        }

        $model   = env('TONGUE_API_MODEL', self::DEFAULT_MODEL);
        $timeout = (int) env('TONGUE_API_TIMEOUT', 45);

        try {
            $response = Http::timeout($timeout)
                ->withHeaders([
                    'x-api-key'          => $key,
                    'anthropic-version'  => '2023-06-01',
                    'content-type'       => 'application/json',
                ])
                ->post(self::API_ENDPOINT, [
                    'model'      => $model,
                    'max_tokens' => 1500,
                    'messages'   => [[
                        'role'    => 'user',
                        'content' => [
                            [
                                'type'   => 'image',
                                'source' => [
                                    'type'       => 'base64',
                                    'media_type' => $imageData['media_type'],
                                    'data'       => $imageData['base64'],
                                ],
                            ],
                            [
                                'type' => 'text',
                                'text' => $this->buildPrompt(),
                            ],
                        ],
                    ]],
                ])
                ->throw()
                ->json();
        } catch (\Throwable $e) {
            Log::error('anthropic_tongue_failed', [
                'err' => $e->getMessage(),
                'url' => $imageUrl,
            ]);
            return ['status' => 'failed', 'error' => $e->getMessage()];
        }

        // Extract the assistant's text reply from the messages-API envelope.
        $text = '';
        foreach (($response['content'] ?? []) as $block) {
            if (($block['type'] ?? null) === 'text') {
                $text .= $block['text'] ?? '';
            }
        }

        $parsed = $this->extractJson($text);
        if (! $parsed) {
            Log::warning('anthropic_tongue_unparseable', ['raw' => substr($text, 0, 500)]);
            return [
                'status' => 'failed',
                'error'  => 'Could not parse classifier output. Image may be unclear or not a tongue.',
            ];
        }

        $normalized = [
            'tongue_color' => $this->normalizeEnum($parsed['tongue_color'] ?? null, array_keys(KnowledgeBase::TONGUE_COLORS)),
            'coating'      => $this->normalizeEnum($parsed['coating']      ?? null, array_keys(KnowledgeBase::TONGUE_COATINGS)),
            'shape'        => $this->normalizeEnum($parsed['shape']        ?? null, array_keys(KnowledgeBase::TONGUE_SHAPES)),
            'teeth_marks'  => (bool) ($parsed['teeth_marks'] ?? false),
            'cracks'       => (bool) ($parsed['cracks']      ?? false),
            'moisture'     => $this->normalizeEnum($parsed['moisture']     ?? null, array_keys(KnowledgeBase::TONGUE_MOISTURE)),
            'midline'      => $this->normalizeEnum($parsed['midline']      ?? null, array_keys(KnowledgeBase::MIDLINE_PATTERNS)),
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
            'raw_response'        => [
                'provider'   => 'anthropic',
                'model'      => $model,
                'classifier' => $parsed,
                'observations' => $parsed['observations'] ?? null,
            ],
        ];
    }

    /**
     * Fetch image bytes and figure out its media type. Supports absolute
     * HTTP(S) URLs (patient portal uploads) and local storage paths.
     */
    private function fetchImage(string $imageUrl): ?array
    {
        try {
            if (preg_match('#^https?://#i', $imageUrl)) {
                $res = Http::timeout(15)->get($imageUrl);
                if (! $res->successful()) return null;
                $bytes = $res->body();
                $mime  = $res->header('Content-Type') ?: 'image/jpeg';
            } else {
                // Local file path (e.g. storage/app/public/...)
                $path = base_path($imageUrl);
                if (! is_file($path)) {
                    // Try storage_path as a second fallback
                    $path = storage_path('app/public/' . ltrim($imageUrl, '/'));
                }
                if (! is_file($path)) return null;
                $bytes = file_get_contents($path);
                $mime  = function_exists('mime_content_type') ? (mime_content_type($path) ?: 'image/jpeg') : 'image/jpeg';
            }

            // Claude Vision supports jpeg / png / gif / webp
            $mime = strtolower(explode(';', $mime)[0]);
            if (! in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
                $mime = 'image/jpeg';
            }

            return [
                'media_type' => $mime,
                'base64'     => base64_encode($bytes),
            ];
        } catch (\Throwable $e) {
            Log::warning('anthropic_tongue_image_fetch_failed', ['url' => $imageUrl, 'err' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Build the structured-output prompt. Lists the exact enum keys the
     * classifier must use so the response drops straight into the
     * AnalysisReport without fuzzy matching.
     */
    private function buildPrompt(): string
    {
        $colors   = $this->enumList(array_keys(KnowledgeBase::TONGUE_COLORS));
        $coatings = $this->enumList(array_keys(KnowledgeBase::TONGUE_COATINGS));
        $shapes   = $this->enumList(array_keys(KnowledgeBase::TONGUE_SHAPES));
        $moisture = $this->enumList(array_keys(KnowledgeBase::TONGUE_MOISTURE));
        $midlines = $this->enumList(array_keys(KnowledgeBase::MIDLINE_PATTERNS));

        return <<<PROMPT
You are a TCM tongue-diagnosis classifier. Analyse the attached tongue photo
and return a single JSON object matching the schema below. Use ONLY the enum
values listed — if you are uncertain, pick the closest option.

If the image is not a tongue, is too blurry, or lighting makes classification
unsafe, return {"error": "<short reason>"} instead.

Required JSON schema:
{
  "tongue_color": one of [{$colors}],
  "coating":      one of [{$coatings}],
  "shape":        one of [{$shapes}],
  "teeth_marks":  true | false,
  "cracks":       true | false,
  "moisture":     one of [{$moisture}],
  "midline":      one of [{$midlines}],
  "observations": "2-4 sentence plain-language summary of what you see (English or bilingual)"
}

Classification guidance:
- tongue_color: judge the body (舌质) colour under the coating, not the coating itself.
- coating: describe thickness, colour, and texture of the 舌苔 (fur).
- shape: overall body shape — normal, swollen/puffy, thin, pointed, deviated, or with visible teeth-mark indentations.
- teeth_marks: indentations along the tongue edges from pressing against teeth.
- cracks: any visible fissures on the tongue body (excluding a single central fold).
- moisture: is the surface moist, dry, slippery/wet-looking, or parched.
- midline: centre line — centred, shifted left/right, or with local bulges.

Return ONLY the JSON object, no surrounding prose, no markdown code fences.
PROMPT;
    }

    private function enumList(array $keys): string
    {
        return '"' . implode('", "', $keys) . '"';
    }

    /**
     * Pull the first {...} block out of the model's reply. Handles Claude
     * returning plain JSON, or wrapped in ```json fences just in case.
     */
    private function extractJson(string $text): ?array
    {
        $text = trim($text);
        // Strip ```json ... ``` fences
        $text = preg_replace('/^```(?:json)?\s*/i', '', $text);
        $text = preg_replace('/\s*```\s*$/', '', $text);

        $start = strpos($text, '{');
        $end   = strrpos($text, '}');
        if ($start === false || $end === false || $end <= $start) return null;
        $json = substr($text, $start, $end - $start + 1);

        $decoded = json_decode($json, true);
        if (! is_array($decoded)) return null;
        if (isset($decoded['error'])) return null;
        return $decoded;
    }

    /** Coerce a provider string into one of our known enum values. */
    private function normalizeEnum(?string $value, array $allowed): ?string
    {
        if ($value === null) return $allowed[0] ?? null;
        $clean = strtolower(trim((string) $value));
        if (in_array($clean, $allowed, true)) return $clean;
        // Fuzzy — replace spaces/hyphens with underscores
        $clean = str_replace([' ', '-'], '_', $clean);
        if (in_array($clean, $allowed, true)) return $clean;
        return $allowed[0] ?? null;
    }
}
