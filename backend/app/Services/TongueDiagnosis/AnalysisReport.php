<?php

namespace App\Services\TongueDiagnosis;

/**
 * Generates a structured constitution report from raw tongue analysis fields.
 * Consumed by the TongueDiagnosisClient after the third-party (or AI) adapter
 * returns parsed tongue features.
 */
class AnalysisReport
{
    public function generate(array $analysis): array
    {
        $constitutions = KnowledgeBase::matchConstitutions($analysis);
        $primary = $constitutions[0] ?? null;

        $color   = KnowledgeBase::TONGUE_COLORS[$analysis['tongue_color']]   ?? null;
        $coating = KnowledgeBase::TONGUE_COATINGS[$analysis['coating']]      ?? null;
        $shape   = KnowledgeBase::TONGUE_SHAPES[$analysis['shape']]          ?? null;
        $moisture = KnowledgeBase::TONGUE_MOISTURE[$analysis['moisture']]    ?? null;
        $midline = KnowledgeBase::MIDLINE_PATTERNS[$analysis['midline'] ?? 'centered'] ?? null;

        $findings = [];
        if ($color)    $findings[] = $this->finding('tongue_color', $color);
        if ($coating)  $findings[] = $this->finding('coating', $coating);
        if ($shape)    $findings[] = $this->finding('shape', $shape);
        if ($moisture) $findings[] = $this->finding('moisture', $moisture);
        if ($midline)  $findings[] = $this->finding('midline', $midline);

        if ($analysis['teeth_marks'] ?? false) {
            $findings[] = [
                'category' => 'teeth_marks',
                'present'  => true,
                'indication_zh' => '脾气虚，水湿内停',
                'indication_en' => 'Spleen qi deficiency, dampness retention',
            ];
        }
        if ($analysis['cracks'] ?? false) {
            $findings[] = [
                'category' => 'cracks',
                'present'  => true,
                'indication_zh' => '阴虚或津液不足；或脾胃热盛',
                'indication_en' => 'Yin deficiency / fluid insufficiency; or spleen-stomach heat',
            ];
        }

        // Health score: 100 = normal, deductions based on severity
        $score = $this->computeScore($analysis, $constitutions);

        // Risk factors
        $risks = [];
        foreach ($constitutions as $c) {
            foreach (($c['details']['risks'] ?? []) as $r) {
                $risks[] = $r;
            }
        }
        $risks = array_unique($risks);

        // Lifestyle recommendations
        $recommendations = $this->recommendations($primary);

        return [
            'constitution' => [
                'primary'   => $primary ? $primary['type'] : 'balanced',
                'name_zh'   => $primary['details']['name_zh'] ?? '平和体质',
                'name_en'   => $primary['details']['name_en'] ?? 'Balanced constitution',
                'confidence'=> $primary['confidence'] ?? 0.5,
                'all_matches' => array_map(fn($c) => [
                    'type'       => $c['type'],
                    'name_zh'    => $c['details']['name_zh'] ?? '',
                    'confidence' => $c['confidence'],
                ], $constitutions),
            ],
            'ten_principle_assessment' => $this->assessTenPrinciples($analysis),
            'findings'        => $findings,
            'health_score'    => $score,
            'risks'           => $risks,
            'recommendations' => $recommendations,
            'three_burner'    => $this->assessThreeBurner($analysis),
        ];
    }

    private function finding(string $category, array $data): array
    {
        return [
            'category'       => $category,
            'value'          => $data['name_en'] ?? '',
            'value_zh'       => $data['name_zh'] ?? '',
            'indication_en'  => $data['indication'] ?? '',
            'indication_zh'  => $data['pattern_zh'] ?? '',
        ];
    }

    private function computeScore(array $a, array $constitutions): int
    {
        $score = 100;
        $color = $a['tongue_color'] ?? 'pale_red';
        $colorData = KnowledgeBase::TONGUE_COLORS[$color] ?? null;

        if ($colorData) {
            $score -= match ($colorData['severity'] ?? 'normal') {
                'critical' => 40, 'severe' => 25, 'moderate' => 10, default => 0,
            };
        }
        if (($a['teeth_marks'] ?? false)) $score -= 5;
        if (($a['cracks'] ?? false))      $score -= 8;
        if (($a['moisture'] ?? 'moist') === 'dry') $score -= 8;

        $coating = $a['coating'] ?? 'thin_white';
        if (in_array($coating, ['yellow_greasy', 'yellow_dry', 'black_dry', 'black_moist'])) $score -= 12;
        elseif (in_array($coating, ['white_greasy', 'grey_moist', 'peeled_no_coating']))     $score -= 6;

        $midline = $a['midline'] ?? 'centered';
        if ($midline !== 'centered') $score -= 8;

        // Bonus for balanced constitution
        if (! empty($constitutions) && $constitutions[0]['type'] === 'balanced') $score = max($score, 85);

        return max(10, min(100, $score));
    }

    private function assessTenPrinciples(array $a): array
    {
        $color = $a['tongue_color'] ?? 'pale_red';
        $coating = $a['coating'] ?? 'thin_white';
        $moisture = $a['moisture'] ?? 'moist';
        $midline = $a['midline'] ?? 'centered';

        $colorData = KnowledgeBase::TONGUE_COLORS[$color] ?? [];
        $hc = $colorData['heat_cold'] ?? 'neutral';
        $de = $colorData['deficiency_excess'] ?? 'balanced';

        return [
            'yin_yang'    => in_array($hc, ['hot']) ? 'yang_dominant' : ($hc === 'cold' ? 'yin_dominant' : 'balanced'),
            'exterior_interior' => $coating === 'thin_white' ? 'possible_exterior_or_normal' : 'interior',
            'cold_heat'   => $hc,
            'deficiency_excess' => $de,
            'ascending'   => $midline === 'shifted_right' ? 'liver_qi_ascending_excess' : 'normal',
            'descending'  => $midline === 'shifted_left' ? 'lung_qi_descending_blocked' : 'normal',
        ];
    }

    private function assessThreeBurner(array $a): array
    {
        // This is a simplified assessment; real AI image analysis would detect per-zone colors
        $color = $a['tongue_color'] ?? 'pale_red';
        $coating = $a['coating'] ?? 'thin_white';
        $coatingData = KnowledgeBase::TONGUE_COATINGS[$coating] ?? [];

        return [
            'upper_jiao' => [
                'status' => in_array($color, ['red', 'deep_red']) ? 'heat' : 'normal',
                'note'   => 'Heart/lung zone at tongue tip',
            ],
            'middle_jiao' => [
                'status' => in_array($coating, ['yellow_greasy', 'white_greasy']) ? 'dampness' : 'normal',
                'note'   => 'Spleen/stomach/liver zone at tongue center',
            ],
            'lower_jiao' => [
                'status' => ($a['moisture'] ?? 'moist') === 'slippery' ? 'cold_dampness' : 'normal',
                'note'   => 'Kidney/bladder/reproductive zone at tongue root',
            ],
        ];
    }

    private function recommendations(?array $primary): array
    {
        if (! $primary) return ['Maintain balanced diet and regular exercise'];

        return match ($primary['type']) {
            'qi_deficient' => [
                'Prioritize rest and avoid overexertion',
                'Eat warm, cooked foods; favor rice porridge, yam (山药), dates',
                'Gentle exercise like Tai Chi or walking',
                'Avoid cold/raw foods and excessive sweating',
            ],
            'yang_deficient' => [
                'Keep warm, especially lower back and abdomen',
                'Eat warming foods: ginger, cinnamon, lamb',
                'Avoid cold/raw foods, iced drinks',
                'Warm foot soaks before bed',
                'Moderate sun exposure in the morning',
            ],
            'yin_deficient' => [
                'Stay well hydrated throughout the day',
                'Eat moistening foods: pear, lily bulb (百合), black sesame',
                'Avoid spicy, fried, and excessively hot foods',
                'Ensure adequate sleep (before 11pm)',
                'Practice gentle meditation or Qigong',
            ],
            'phlegm_dampness' => [
                'Reduce greasy, sweet, and dairy-heavy foods',
                'Eat light foods: barley (薏苡仁), lotus seed, winter melon',
                'Regular aerobic exercise to promote circulation',
                'Avoid damp environments',
            ],
            'damp_heat' => [
                'Avoid alcohol, spicy, and greasy foods',
                'Eat cooling, dampness-draining foods: mung bean, cucumber, bitter melon',
                'Maintain good hygiene, keep skin dry',
                'Regular moderate exercise',
            ],
            'blood_stasis' => [
                'Stay physically active to promote blood circulation',
                'Include foods that invigorate blood: hawthorn, turmeric, dark leafy greens',
                'Avoid prolonged sitting or standing',
                'Keep warm to prevent cold-induced stasis',
            ],
            'qi_stagnation' => [
                'Manage stress through meditation, deep breathing, or counseling',
                'Regular outdoor exercise to move qi',
                'Eat foods that soothe liver qi: chrysanthemum tea, citrus peel, mint',
                'Maintain regular sleep schedule',
                'Engage in creative or social activities',
            ],
            default => [
                'Maintain balanced diet with varied whole foods',
                'Regular moderate exercise',
                'Adequate sleep (7-8 hours)',
                'Manage stress levels',
            ],
        };
    }
}
