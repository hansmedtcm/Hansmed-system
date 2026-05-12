<?php

namespace App\Services\WellnessAssessment;

use App\Services\WellnessAssessment\PatternQuestionBank;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Brief #22 · Picks the most-relevant TCM confirmation questions for a
 * given tongue analysis result.
 *
 * Strategy:
 *   1. For each of the top-2 umbrella patterns (heat, yin_deficiency,
 *      blood_stasis, etc.), look up candidate syndrome IDs from
 *      PatternQuestionBank::PATTERN_TO_SYNDROMES.
 *   2. Ask Claude (small fast call) to pick the most-fitting specific
 *      syndrome from those candidates based on the tongue's specific
 *      signs, then choose 3-4 questions from that syndrome's bank.
 *   3. If Claude fails / times out, fall back to the deterministic
 *      PatternQuestionBank::selectQuestionsFor() which uses
 *      clinical_weight + signal_signs as the ranking.
 *
 * Output: { syndrome_id, syndrome_name_zh, questions: [...] } per pattern.
 */
class AdaptiveQuestionSelector
{
    private const ANTHROPIC_URL   = 'https://api.anthropic.com/v1/messages';
    private const DEFAULT_MODEL   = 'claude-haiku-4-5-20251001';
    private const TIMEOUT_SECONDS = 12;

    /**
     * Main entry point.
     *
     * @param array $topPatterns  e.g. [
     *   ['pattern' => 'yin_deficiency', 'confidence' => 0.72],
     *   ['pattern' => 'heat',           'confidence' => 0.41],
     * ]
     * @param array $tongueSigns  e.g. ['red_tip', 'peeled_root', 'cracked']
     * @return array              Per-pattern question selections.
     */
    public function select(array $topPatterns, array $tongueSigns): array
    {
        $selections = [];
        foreach ($topPatterns as $pat) {
            $umbrella  = $pat['pattern']    ?? null;
            $candidates = PatternQuestionBank::syndromesFor($umbrella);
            if (empty($candidates)) {
                continue; // no questions for this umbrella (e.g. 'normal')
            }

            // 2026-05-12 — Claude-driven selector temporarily disabled.
            // The Anthropic call was hanging past its 12s timeout in
            // production, blocking Stage 3 → Stage 4 transition. Go
            // straight to the deterministic local selector which uses
            // clinical_weight + signal_signs from the curated
            // PatternQuestionBank. Re-enable by uncommenting the
            // tryClaudeSelector line once the upstream timeout issue
            // is understood.
            // $picked = $this->tryClaudeSelector($umbrella, $candidates, $tongueSigns);
            $picked = $this->deterministicFallback($candidates, $tongueSigns);

            if ($picked) {
                $selections[] = $picked + [
                    'umbrella_pattern' => $umbrella,
                    'confidence'       => $pat['confidence'] ?? null,
                ];
            }
        }
        return $selections;
    }

    /**
     * Ask Claude to pick the best-fitting specific syndrome from the
     * candidate list, then pick 3-4 questions tagged with one of the
     * tongue's actual signs.
     */
    private function tryClaudeSelector(string $umbrella, array $candidates, array $tongueSigns): ?array
    {
        $key = env('TONGUE_API_KEY') ?? null; // reuse the existing key
        if (! $key) return null;

        // Build a compact prompt with just what Claude needs.
        $candidateInfo = [];
        foreach ($candidates as $sid) {
            $entry = PatternQuestionBank::forSyndrome($sid);
            if (! $entry) continue;
            $candidateInfo[$sid] = [
                'name'         => $entry['name_en'] . ' (' . $entry['name_zh'] . ')',
                'tongue_signs' => $entry['tongue_signs'] ?? [],
                'question_ids' => array_column($entry['questions'] ?? [], 'id'),
            ];
        }

        $prompt = "A TCM tongue analysis surfaced the pattern '{$umbrella}' with these tongue signs: "
            . implode(', ', $tongueSigns) . ".\n\n"
            . "Available specific syndromes for this umbrella:\n"
            . json_encode($candidateInfo, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n"
            . "Pick the SINGLE most-fitting syndrome ID. Then select 3-4 question IDs from "
            . "that syndrome's question_ids array to ask the patient — prefer questions "
            . "whose signal_signs match the tongue signs observed.\n\n"
            . "Reply ONLY with strict JSON: {\\\"syndrome_id\\\":\\\"SY##\\\",\\\"question_ids\\\":[\\\"...\\\",...]}.";

        try {
            $resp = Http::timeout(self::TIMEOUT_SECONDS)
                ->withHeaders([
                    'x-api-key'         => $key,
                    'anthropic-version' => '2023-06-01',
                    'content-type'      => 'application/json',
                ])
                ->post(self::ANTHROPIC_URL, [
                    'model'      => env('WELLNESS_SELECTOR_MODEL', self::DEFAULT_MODEL),
                    'max_tokens' => 400,
                    'messages'   => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                ]);
            if (! $resp->ok()) {
                Log::warning('AdaptiveQuestionSelector Claude HTTP ' . $resp->status());
                return null;
            }
            $body = $resp->json();
            $text = $body['content'][0]['text'] ?? '';
            // Extract JSON — Claude sometimes wraps in code fences
            if (preg_match('/\\{[^{}]*\\"syndrome_id\\"[\\s\\S]*?\\}/u', $text, $m)) {
                $picked = json_decode($m[0], true);
                if (isset($picked['syndrome_id'], $picked['question_ids'])) {
                    $entry = PatternQuestionBank::forSyndrome($picked['syndrome_id']);
                    if (! $entry) return null;
                    $qMap = [];
                    foreach ($entry['questions'] as $q) { $qMap[$q['id']] = $q; }
                    $chosen = [];
                    foreach ($picked['question_ids'] as $qid) {
                        if (isset($qMap[$qid])) $chosen[] = $qMap[$qid];
                    }
                    if (count($chosen) >= 2) {
                        return [
                            'syndrome_id'      => $picked['syndrome_id'],
                            'syndrome_name_zh' => $entry['name_zh'],
                            'syndrome_name_en' => $entry['name_en'],
                            'selector'         => 'claude',
                            'questions'        => $chosen,
                        ];
                    }
                }
            }
            return null;
        } catch (\Throwable $e) {
            Log::warning('AdaptiveQuestionSelector Claude error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Deterministic fallback — pick the first candidate syndrome and
     * use the local weighted selector. Works without any external call.
     */
    private function deterministicFallback(array $candidates, array $tongueSigns): ?array
    {
        $sid = $candidates[0] ?? null;
        if (! $sid) return null;
        $entry = PatternQuestionBank::forSyndrome($sid);
        if (! $entry) return null;
        return [
            'syndrome_id'      => $sid,
            'syndrome_name_zh' => $entry['name_zh'],
            'syndrome_name_en' => $entry['name_en'],
            'selector'         => 'deterministic',
            'questions'        => PatternQuestionBank::selectQuestionsFor($sid, $tongueSigns, 4),
        ];
    }
}
