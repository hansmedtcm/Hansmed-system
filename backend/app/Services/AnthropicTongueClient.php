<?php

namespace App\Services;

use App\Services\TongueAssessment\AnalysisReport;
use App\Services\TongueAssessment\KnowledgeBase;
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
     * TongueAssessmentClient::map() so the existing controller code works
     * without any changes.
     */
    public function analyze(string $imageUrl): array
    {
        $key = config('services.tongue_diagnosis.key');
        if (empty($key)) {
            return $this->failureResponse('TONGUE_API_KEY is not set on the server');
        }

        // Fetch the image and convert to base64 for the multimodal payload.
        $imageData = $this->fetchImage($imageUrl);
        if (! $imageData) {
            return $this->failureResponse('Could not fetch tongue image — storage path not found');
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
            return $this->failureResponse('Anthropic API error: ' . $e->getMessage());
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
            return $this->failureResponse('Could not parse classifier output — image may be unclear or not a tongue', [
                'raw_text' => substr($text, 0, 500),
            ]);
        }

        $normalized = [
            // Whole-tongue classification (primary enums)
            'tongue_color' => $this->normalizeEnum($parsed['tongue_color'] ?? null, array_keys(KnowledgeBase::TONGUE_COLORS)),
            'coating'      => $this->normalizeEnum($parsed['coating']      ?? null, array_keys(KnowledgeBase::TONGUE_COATINGS)),
            'shape'        => $this->normalizeEnum($parsed['shape']        ?? null, array_keys(KnowledgeBase::TONGUE_SHAPES)),
            'teeth_marks'  => (bool) ($parsed['teeth_marks'] ?? false),
            'cracks'       => (bool) ($parsed['cracks']      ?? false),
            'moisture'     => $this->normalizeEnum($parsed['moisture']     ?? null, array_keys(KnowledgeBase::TONGUE_MOISTURE)),
            'midline'      => $this->normalizeEnum($parsed['midline']      ?? null, array_keys(KnowledgeBase::MIDLINE_PATTERNS)),

            // ─── Deep analysis fields (Yin Modern Tongue Diagnosis framework) ───
            // Per-zone colour + coating so AnalysisReport can apply the
            // three-burner + holographic-map + six-meridian rules properly.
            'zones' => [
                'upper_jiao'   => $this->normalizeZone($parsed['zones']['upper_jiao']   ?? null),
                'middle_jiao'  => $this->normalizeZone($parsed['zones']['middle_jiao']  ?? null),
                'lower_jiao'   => $this->normalizeZone($parsed['zones']['lower_jiao']   ?? null),
                'left_edge'    => $this->normalizeZone($parsed['zones']['left_edge']    ?? null),
                'right_edge'   => $this->normalizeZone($parsed['zones']['right_edge']   ?? null),
            ],
            // Specific clinical signs that trigger formula guidance
            'signs' => [
                'upper_jiao_red_dots' => $this->normalizeSignExtent($parsed['signs']['upper_jiao_red_dots'] ?? null),
                'horseshoe_shape'     => (bool) ($parsed['signs']['horseshoe_shape']     ?? false),
                'root_greasy_coat'    => (bool) ($parsed['signs']['root_greasy_coat']    ?? false),
                'tip_red_area'        => (bool) ($parsed['signs']['tip_red_area']        ?? false),
                'heart_zone_depression' => (bool) ($parsed['signs']['heart_zone_depression'] ?? false),
                'liver_gb_swelling'   => (bool) ($parsed['signs']['liver_gb_swelling']   ?? false),
                'radiating_cracks'    => (bool) ($parsed['signs']['radiating_cracks']    ?? false),
                'sublingual_veins_engorged' => (bool) ($parsed['signs']['sublingual_veins_engorged'] ?? false),
                'petechiae'           => (bool) ($parsed['signs']['petechiae']           ?? false),
            ],
            // Ascending / descending indicator — relative tip height
            'tip_elevation' => $this->normalizeTipElevation($parsed['tip_elevation'] ?? null),

            // Free-form overall impression from the vision model for the
            // doctor to glance at alongside the structured findings
            'observations' => isset($parsed['observations']) ? (string) $parsed['observations'] : null,
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
     * Fetch image bytes and figure out its media type.
     *
     * Railway deploys often serve uploaded files through Storage::url() —
     * which returns either a relative path ("/storage/tongue/abc.jpg")
     * or an absolute URL pointing back at the same container. Hitting
     * that URL over HTTP from inside the container is flaky (wrong
     * APP_URL, TLS quirks, storage-link not created). So we try
     * filesystem reads first, and only fall back to HTTP for genuinely
     * external URLs (e.g. S3-backed storage).
     */
    private function fetchImage(string $imageUrl): ?array
    {
        try {
            $bytes = null;
            $mime  = 'image/jpeg';

            // ── 1. Filesystem-first strategy ─────────────────────────
            // Try every plausible on-disk location before giving up and
            // going over the network. This is by far the most reliable
            // path on Railway's single-container deploy.
            $candidates = $this->localPathCandidates($imageUrl);
            foreach ($candidates as $candidate) {
                if (is_file($candidate)) {
                    $bytes = file_get_contents($candidate);
                    if (function_exists('mime_content_type')) {
                        $mime = mime_content_type($candidate) ?: $mime;
                    }
                    break;
                }
            }

            // ── 2. HTTP fallback ─────────────────────────────────────
            // Only bother when the URL is clearly external AND we
            // couldn't find it on disk.
            if ($bytes === null && preg_match('#^https?://#i', $imageUrl)) {
                $res = Http::timeout(15)->get($imageUrl);
                if ($res->successful()) {
                    $bytes = $res->body();
                    $mime  = $res->header('Content-Type') ?: 'image/jpeg';
                } else {
                    Log::warning('anthropic_tongue_http_fetch_failed', [
                        'url'    => $imageUrl,
                        'status' => $res->status(),
                        'tried'  => $candidates,
                    ]);
                }
            }

            if ($bytes === null) {
                Log::warning('anthropic_tongue_image_not_found', [
                    'url'   => $imageUrl,
                    'tried' => $candidates,
                ]);
                return null;
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
     * Produce every plausible on-disk path for a given image URL. Handles
     *   • "/storage/tongue/abc.jpg"         (relative URL from Storage::url)
     *   • "https://<our-domain>/storage/…"  (absolute URL from Storage::url)
     *   • "tongue/abc.jpg"                  (raw store() return value)
     *   • absolute filesystem paths
     */
    private function localPathCandidates(string $imageUrl): array
    {
        $path = $imageUrl;

        // Strip scheme + host — leaves just the path portion
        if (preg_match('#^https?://[^/]+(/.*)$#i', $path, $m)) {
            $path = $m[1];
        }

        // Normalise leading slashes
        $path = ltrim($path, '/');

        // Map common URL prefixes back to the on-disk location.
        //   /api/uploads/tongue/abc.jpg → storage/app/public/tongue/abc.jpg
        //   /storage/tongue/abc.jpg     → storage/app/public/tongue/abc.jpg
        $relative = $path;
        if (str_starts_with($relative, 'api/uploads/')) {
            $relative = substr($relative, strlen('api/uploads/'));
        } elseif (str_starts_with($relative, 'uploads/')) {
            $relative = substr($relative, strlen('uploads/'));
        } elseif (str_starts_with($relative, 'storage/')) {
            $relative = substr($relative, strlen('storage/'));
        }

        return array_unique([
            storage_path('app/public/' . $relative),
            storage_path('app/public/' . $path),
            public_path($path),
            public_path('storage/' . $relative),
            base_path($path),
        ]);
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
You are a TCM tongue-diagnosis classifier applying the Yin Modern Tongue
Diagnosis framework (殷氏现代舌诊). Analyse the attached tongue photo and
return a single JSON object matching the schema below. Use ONLY the enum
values listed — if uncertain, pick the closest option.

If the image is not a tongue, is too blurry, or lighting makes safe
classification impossible, return {"error": "<short reason>"} instead.

Required JSON schema:
{
  "tongue_color": one of [{$colors}],
  "coating":      one of [{$coatings}],
  "shape":        one of [{$shapes}],
  "teeth_marks":  true | false,
  "cracks":       true | false,
  "moisture":     one of [{$moisture}],
  "midline":      one of [{$midlines}],

  "zones": {
    "upper_jiao":  { "color": "<color enum>", "coating": "<coating enum>", "notes": "<one-phrase observation>" },
    "middle_jiao": { "color": "<color enum>", "coating": "<coating enum>", "notes": "<one-phrase observation>" },
    "lower_jiao":  { "color": "<color enum>", "coating": "<coating enum>", "notes": "<one-phrase observation>" },
    "left_edge":   { "color": "<color enum>", "notes": "<one-phrase observation of left side>" },
    "right_edge":  { "color": "<color enum>", "notes": "<one-phrase observation of right side>" }
  },

  "signs": {
    "upper_jiao_red_dots":       "none" | "small" | "medium" | "full" | "extending_to_middle",
    "horseshoe_shape":           true | false,
    "root_greasy_coat":          true | false,
    "tip_red_area":              true | false,
    "heart_zone_depression":     true | false,
    "liver_gb_swelling":         true | false,
    "radiating_cracks":          true | false,
    "sublingual_veins_engorged": true | false,
    "petechiae":                 true | false
  },

  "tip_elevation": "level" | "left_higher" | "right_higher",

  "observations": "2-4 sentence overall clinical impression in bilingual English + 中文"
}

Zone mapping (for the "zones" object):
- upper_jiao   = tongue tip to ~1/3 from tip (maps to heart, lungs, head, throat)
- middle_jiao  = middle 1/3 of tongue (maps to spleen, stomach; left edge = liver, right edge = lung/GB)
- lower_jiao   = posterior 1/3 + root (maps to kidneys, bladder, intestines, pelvis)
- left_edge / right_edge = bilateral edges across the tongue (liver/GB zone)

Clinical sign detection:
- upper_jiao_red_dots: red prickles at tip — estimate extent.
  "small" = few dots on tip only; "medium" = upper 2/3 coverage;
  "full" = full upper jiao; "extending_to_middle" = into middle third.
- horseshoe_shape: upper jiao + both edges raised, centre depressed (like a horseshoe).
- root_greasy_coat: thick greasy coating concentrated specifically at tongue root.
- tip_red_area: red patch/discolouration at the tongue tip.
- heart_zone_depression: visible depression in the upper-jiao heart area.
- liver_gb_swelling: bilateral swelling in the middle-jiao side edges.
- radiating_cracks: fissures spreading outward like dried cracked earth.
- sublingual_veins_engorged: not visible unless tongue underside is shown — default false.
- petechiae: dark purple spots (瘀斑) on the tongue body.

tip_elevation:
- "left_higher"  = left tip sits higher (liver qi ascending excess)
- "right_higher" = right tip sits higher (lung qi failing to descend)
- "level"        = both tips at same height

Classification guidance:
- tongue_color: judge the body (舌质) colour under the coating, not the coating itself.
- coating: describe thickness, colour, and texture of the 舌苔 (fur).
- shape: overall body shape.
- moisture: is the surface moist, dry, slippery/wet, or parched.
- midline: centre line — centred, shifted left/right, or with local bulges.

Return ONLY the JSON object, no surrounding prose, no markdown code fences.
PROMPT;
    }

    /** Normalise a per-zone observation, defaulting missing fields. */
    private function normalizeZone($zone): array
    {
        if (! is_array($zone)) return ['color' => null, 'coating' => null, 'notes' => null];
        return [
            'color'   => $this->normalizeEnum($zone['color']   ?? null, array_keys(KnowledgeBase::TONGUE_COLORS)),
            'coating' => $this->normalizeEnum($zone['coating'] ?? null, array_keys(KnowledgeBase::TONGUE_COATINGS)),
            'notes'   => isset($zone['notes']) ? (string) $zone['notes'] : null,
        ];
    }

    /** Clamp an upper-jiao red-dot extent to the known values. */
    private function normalizeSignExtent($value): string
    {
        $v = strtolower(trim((string) $value));
        $allowed = ['none', 'small', 'medium', 'full', 'extending_to_middle'];
        return in_array($v, $allowed, true) ? $v : 'none';
    }

    /** Clamp tip-elevation to the known values. */
    private function normalizeTipElevation($value): string
    {
        $v = strtolower(trim((string) $value));
        return in_array($v, ['level', 'left_higher', 'right_higher'], true) ? $v : 'level';
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

    /**
     * Build a failure response that actually surfaces the reason. Shoves
     * the error into raw_response (which IS fillable on TongueAssessment)
     * so the doctor review modal can show the real reason instead of an
     * opaque "failed" status, and admins can debug from the DB.
     */
    private function failureResponse(string $message, array $extra = []): array
    {
        return [
            'status'       => 'failed',
            'raw_response' => array_merge([
                'provider' => 'anthropic',
                'error'    => $message,
                'failed_at' => now()->toIso8601String(),
            ], $extra),
        ];
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
