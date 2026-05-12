<?php

namespace App\Services\WellnessAssessment;

use App\Services\WellnessAssessment\data\TreatmentBank;

/**
 * Brief #22 §11 · TreatmentSuggester.
 *
 * Produces the "Suggested treatment starting point" payload for the
 * doctor handoff. Inputs: top TCM patterns + RedFlag triggers.
 * Output: structured suggestion with classical formula + composition +
 * RedFlag-driven modifications.
 *
 * Anti-anchoring discipline: this is doctor-facing only and the UI
 * NEVER auto-prescribes. The doctor must actively click "Start
 * prescription from this" before any prescription is created.
 *
 * Data source: classical formulas only (1000+ years old, public domain)
 * baked into TreatmentBank from the curated tier-1 spreadsheet. The
 * 845-page treatment textbook is intentionally NOT auto-ingested in v1
 * — it stays as the doctor\'s personal reference.
 */
class TreatmentSuggester
{
    private const MIN_CONFIDENCE = 0.6;

    /**
     * @param array $topPatterns Top-2 patterns from tongue analysis.
     *   Each: [\'pattern\', \'confidence\', \'syndrome_id\' (optional)]
     * @param array $redFlagsDetected Output of RedFlagScreener::screen()
     * @return array|null  Suggestion payload, or null if no confident match.
     */
    public function suggest(array $topPatterns, array $redFlagsDetected): ?array
    {
        if (empty($topPatterns)) return null;

        // 1. Determine primary syndrome.
        $primary = $this->resolveSyndrome($topPatterns[0] ?? null);
        if (! $primary) return null;

        // 2. Determine secondary (only if its confidence is reasonable
        //    and it\'s different from the primary).
        $secondary = $this->resolveSyndrome($topPatterns[1] ?? null);
        if ($secondary && $secondary[\'id\'] === $primary[\'id\']) {
            $secondary = null;
        }

        // 3. Get composition for primary formula.
        $formula = $this->lookupFormula($primary[\'formula_zh\']);

        // 4. Cross-reference composition against RedFlags to produce
        //    modification suggestions.
        $modifications = $this->computeModifications($formula, $redFlagsDetected);

        $payload = [
            \'primary\' => [
                \'syndrome_id\'           => $primary[\'id\'],
                \'syndrome_name_zh\'      => $primary[\'name_zh\'],
                \'syndrome_name_en\'      => $primary[\'name_en\'],
                \'confidence\'            => $primary[\'confidence\'],
                \'formula_zh\'            => $primary[\'formula_zh\'],
                \'formula_pinyin\'        => $formula[\'pinyin\'] ?? null,
                \'treatment_principle\'   => $primary[\'treatment_principle\'],
                \'source\'                => $formula[\'source\'] ?? $primary[\'source\'],
                \'composition\'           => $formula[\'composition\'] ?? null,
                \'modifications\'         => $modifications,
            ],
        ];

        if ($secondary) {
            $payload[\'secondary_consideration\'] = [
                \'syndrome_id\'      => $secondary[\'id\'],
                \'syndrome_name_zh\' => $secondary[\'name_zh\'],
                \'syndrome_name_en\' => $secondary[\'name_en\'],
                \'confidence\'       => $secondary[\'confidence\'],
                \'note\'             => \'Consider only if confirmed during consult\',
                \'formula_options\'  => $this->splitFormulas($secondary[\'formula_zh\']),
            ];
        }

        return $payload;
    }

    /**
     * Look up syndrome metadata by either explicit syndrome_id OR by
     * resolving it from PatternQuestionBank::PATTERN_TO_SYNDROMES on
     * the umbrella pattern.
     */
    private function resolveSyndrome(?array $patternEntry): ?array
    {
        if (! $patternEntry) return null;
        $confidence = (float) ($patternEntry[\'confidence\'] ?? 0);
        if ($confidence < self::MIN_CONFIDENCE) return null;

        $sid = $patternEntry[\'syndrome_id\'] ?? null;
        if (! $sid) {
            $candidates = PatternQuestionBank::syndromesFor($patternEntry[\'pattern\'] ?? \'\');
            $sid = $candidates[0] ?? null;
        }
        if (! $sid) return null;

        $entry = TreatmentBank::SYNDROMES[$sid] ?? null;
        if (! $entry) return null;

        // Extract the FIRST formula from the (possibly semicolon-separated) list.
        $formulas = $this->splitFormulas($entry[\'default_formulas\'] ?? \'\');
        $firstFormula = $formulas[0] ?? null;

        return [
            \'id\'                  => $entry[\'id\'],
            \'name_zh\'             => $entry[\'name_zh\'],
            \'name_en\'             => $entry[\'name_en\'],
            \'treatment_principle\' => $entry[\'treatment_principle\'],
            \'source\'              => $entry[\'source\'],
            \'formula_zh\'          => $firstFormula,
            \'confidence\'          => $confidence,
        ];
    }

    /** Look up formula composition + metadata from TreatmentBank.
     *  Strips the optional Pinyin parenthetical from the ZH name when matching. */
    private function lookupFormula(?string $formulaZh): ?array
    {
        if (! $formulaZh) return null;
        $key = trim(preg_replace(\'/\\s*\\([^)]*\\)\\s*$/\', \'\', $formulaZh));
        return TreatmentBank::FORMULAS[$key] ?? TreatmentBank::FORMULAS[$formulaZh] ?? null;
    }

    /** Parse the "default formula" cell which may list multiple options
     *  separated by ; / ， / 、 */
    private function splitFormulas(?string $raw): array
    {
        if (! $raw) return [];
        $parts = preg_split(\'/[;，；、]/u\', $raw);
        return array_values(array_filter(array_map(\'trim\', $parts)));
    }

    /** For each composition herb, see if any triggered RedFlag rule
     *  lists it in avoid_herbs[]. If yes, produce a modification entry. */
    private function computeModifications(?array $formula, array $redFlagsDetected): array
    {
        $mods = [];
        if (! $formula || empty($formula)) return $mods;

        // Composition is stored as text in FORMULAS["composition"];
        // parse the herbs out — they\'re typically Chinese names
        // separated by ;, ,, 、, or 加.
        $compRaw = $formula[\'composition\'] ?? \'\';
        if (! is_string($compRaw) || $compRaw === \'\') return $mods;
        $herbsInFormula = preg_split(\'/[;，；、+加]/u\', $compRaw);
        $herbsInFormula = array_filter(array_map(function ($h) {
            // Strip dose suffix (e.g. "丹參 15g" → "丹參")
            $h = trim(preg_replace(\'/\\s*\\d+\\s*g?$/iu\', \'\', $h));
            // Strip parenthetical
            return trim(preg_replace(\'/\\s*\\([^)]*\\)\\s*/\', \'\', $h));
        }, $herbsInFormula));

        foreach ($redFlagsDetected as $flag) {
            $avoid = $flag[\'avoid_herbs\'] ?? [];
            $affected = [];
            foreach ($avoid as $avoidHerb) {
                foreach ($herbsInFormula as $compHerb) {
                    if ($compHerb !== \'\' && str_contains($avoidHerb, $compHerb)) {
                        $affected[] = $compHerb;
                        break;
                    }
                }
            }
            if (! empty($affected)) {
                $mods[] = [
                    \'rf_id\'             => $flag[\'id\'] ?? null,
                    \'trigger\'           => $flag[\'triggered_by\'] ?? $flag[\'condition\'] ?? null,
                    \'affected_herbs_zh\' => array_values(array_unique($affected)),
                    \'suggested_change\'  => \'reduce dose, substitute, or remove based on clinical judgement\',
                    \'severity\'          => $flag[\'severity\'] ?? \'relative\',
                    \'reason\'            => $flag[\'reason\'] ?? null,
                ];
            }
        }

        return $mods;
    }
}
