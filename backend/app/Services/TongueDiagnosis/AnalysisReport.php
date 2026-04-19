<?php

namespace App\Services\TongueDiagnosis;

/**
 * Generates a structured TCM tongue diagnosis report.
 *
 * Consumes the Claude Vision / third-party adapter output and produces a
 * deep analysis grounded in the Yin Modern Tongue Diagnosis framework:
 *   • 十纲 Ten Principles
 *   • 三焦 Three Burners (with per-zone organ mapping)
 *   • 全息图 Holographic body map (14 regions)
 *   • 六经辨证 Six-meridian zones
 *   • Clinical sign patterns with formula guidance
 *   • Ascending/descending analysis with treatment cautions
 */
class AnalysisReport
{
    public function generate(array $analysis): array
    {
        $constitutions = KnowledgeBase::matchConstitutions($analysis);
        $primary = $constitutions[0] ?? null;

        $color    = KnowledgeBase::TONGUE_COLORS[$analysis['tongue_color']]     ?? null;
        $coating  = KnowledgeBase::TONGUE_COATINGS[$analysis['coating']]        ?? null;
        $shape    = KnowledgeBase::TONGUE_SHAPES[$analysis['shape']]            ?? null;
        $moisture = KnowledgeBase::TONGUE_MOISTURE[$analysis['moisture']]       ?? null;
        $midline  = KnowledgeBase::MIDLINE_PATTERNS[$analysis['midline'] ?? 'centered'] ?? null;

        $findings = [];
        if ($color)    $findings[] = $this->finding('tongue_color', $color);
        if ($coating)  $findings[] = $this->finding('coating', $coating);
        if ($shape)    $findings[] = $this->finding('shape', $shape);
        if ($moisture) $findings[] = $this->finding('moisture', $moisture);
        if ($midline)  $findings[] = $this->finding('midline', $midline);

        if ($analysis['teeth_marks'] ?? false) {
            $findings[] = [
                'category'      => 'teeth_marks',
                'present'       => true,
                'indication_zh' => '脾气虚，水湿内停',
                'indication_en' => 'Spleen qi deficiency, dampness retention',
            ];
        }
        if ($analysis['cracks'] ?? false) {
            $findings[] = [
                'category'      => 'cracks',
                'present'       => true,
                'indication_zh' => '阴虚或津液不足；或脾胃热盛',
                'indication_en' => 'Yin deficiency / fluid insufficiency; or spleen-stomach heat',
            ];
        }

        $score = $this->computeScore($analysis, $constitutions);

        $risks = [];
        foreach ($constitutions as $c) {
            foreach (($c['details']['risks'] ?? []) as $r) $risks[] = $r;
        }
        $risks = array_values(array_unique($risks));

        $recommendations = $this->recommendations($primary);

        // Deep-analysis layers — only populated when the vision adapter
        // provides the per-zone / signs / tip-elevation data.
        $threeBurner       = $this->assessThreeBurner($analysis);
        $holographicMap    = $this->assessHolographic($analysis);
        $sixMeridians      = $this->assessSixMeridians($analysis);
        $clinicalPatterns  = $this->detectClinicalPatterns($analysis);
        $ascDesc           = $this->assessAscendingDescending($analysis);

        return [
            'constitution' => [
                'primary'    => $primary ? $primary['type'] : 'balanced',
                'name_zh'    => $primary['details']['name_zh'] ?? '平和体质',
                'name_en'    => $primary['details']['name_en'] ?? 'Balanced constitution',
                'confidence' => $primary['confidence'] ?? 0.5,
                'all_matches' => array_map(fn($c) => [
                    'type'       => $c['type'],
                    'name_zh'    => $c['details']['name_zh'] ?? '',
                    'confidence' => $c['confidence'],
                ], $constitutions),
            ],
            'ten_principle_assessment' => $this->assessTenPrinciples($analysis),
            'findings'             => $findings,
            'health_score'         => $score,
            'risks'                => $risks,
            'recommendations'      => $recommendations,
            'three_burner'         => $threeBurner,
            'holographic_map'      => $holographicMap,
            'six_meridians'        => $sixMeridians,
            'clinical_patterns'    => $clinicalPatterns,
            'ascending_descending' => $ascDesc,
            'observations'         => $analysis['observations'] ?? null,
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

        // Deep-sign deductions
        $signs = $a['signs'] ?? [];
        if (($signs['horseshoe_shape']        ?? false))                 $score -= 10;
        if (($signs['radiating_cracks']       ?? false))                 $score -= 12;
        if (($signs['petechiae']              ?? false))                 $score -= 8;
        if (($signs['sublingual_veins_engorged'] ?? false))              $score -= 6;
        $redDots = $signs['upper_jiao_red_dots'] ?? 'none';
        $score -= match ($redDots) { 'small' => 3, 'medium' => 6, 'full' => 10, 'extending_to_middle' => 15, default => 0 };

        if (! empty($constitutions) && $constitutions[0]['type'] === 'balanced') $score = max($score, 85);

        return max(10, min(100, $score));
    }

    private function assessTenPrinciples(array $a): array
    {
        $color    = $a['tongue_color'] ?? 'pale_red';
        $coating  = $a['coating']      ?? 'thin_white';
        $moisture = $a['moisture']     ?? 'moist';
        $midline  = $a['midline']      ?? 'centered';
        $tipElev  = $a['tip_elevation'] ?? 'level';

        $colorData = KnowledgeBase::TONGUE_COLORS[$color] ?? [];
        $hc = $colorData['heat_cold'] ?? 'neutral';
        $de = $colorData['deficiency_excess'] ?? 'balanced';

        return [
            'yin_yang'          => $hc === 'hot' ? 'yang_dominant' : ($hc === 'cold' ? 'yin_dominant' : 'balanced'),
            'exterior_interior' => $coating === 'thin_white' ? 'possible_exterior_or_normal' : 'interior',
            'cold_heat'         => $hc,
            'deficiency_excess' => $de,
            'ascending'         => $tipElev === 'left_higher'  ? 'liver_qi_ascending_excess' :
                                   ($midline === 'shifted_right' ? 'liver_qi_ascending_suspected' : 'normal'),
            'descending'        => $tipElev === 'right_higher' ? 'lung_qi_descending_blocked' :
                                   ($midline === 'shifted_left' ? 'lung_qi_descending_suspected' : 'normal'),
        ];
    }

    /**
     * Per-zone three-burner assessment. When the vision adapter returned
     * per-zone colour + coating data we apply those directly; otherwise we
     * fall back to heuristics over the whole-tongue classification.
     */
    private function assessThreeBurner(array $a): array
    {
        $zones = $a['zones'] ?? [];
        $result = [];

        foreach (['upper_jiao', 'middle_jiao', 'lower_jiao'] as $zoneKey) {
            $zone     = $zones[$zoneKey] ?? null;
            $zoneMeta = KnowledgeBase::THREE_BURNER_ZONES[$zoneKey] ?? [];
            $zoneColor   = $zone['color']   ?? null;
            $zoneCoating = $zone['coating'] ?? null;

            $status      = 'normal';
            $explanation = [];

            // Colour-based status
            if (in_array($zoneColor, ['red', 'deep_red'], true)) {
                $status = 'heat';
                $explanation[] = $zoneKey === 'upper_jiao'
                    ? 'Heat signs in heart/lung zone'
                    : ($zoneKey === 'middle_jiao' ? 'Heat in spleen/stomach zone' : 'Heat descending into lower jiao');
            } elseif (in_array($zoneColor, ['pale_white'], true)) {
                $status = 'deficiency_cold';
                $explanation[] = 'Pale colour indicates cold / qi-blood deficiency in this region';
            } elseif (in_array($zoneColor, ['purple', 'blue_purple'], true)) {
                $status = 'stasis';
                $explanation[] = 'Dark colour indicates blood stasis in this region';
            }

            // Coating-based overlay
            if (in_array($zoneCoating, ['yellow_greasy', 'yellow_dry'], true)) {
                $status = 'damp_heat';
                $explanation[] = 'Yellow greasy coating — damp-heat accumulation';
            } elseif (in_array($zoneCoating, ['white_greasy', 'grey_moist', 'white_sticky_stringy'], true)) {
                $status = 'dampness';
                $explanation[] = 'White greasy/sticky coating — phlegm-damp or cold-damp';
            } elseif ($zoneCoating === 'peeled_no_coating') {
                $status = 'yin_deficiency';
                $explanation[] = 'Peeled / no coating — stomach yin depletion in this zone';
            }

            // Fallback heuristics if zone data wasn't provided
            if (! $zone || (! $zoneColor && ! $zoneCoating)) {
                $status = $this->fallbackBurnerStatus($zoneKey, $a);
            }

            $result[$zoneKey] = [
                'name_zh'      => $zoneMeta['name_zh'] ?? '',
                'name_en'      => $zoneMeta['name_en'] ?? '',
                'organs'       => $zoneMeta['organs'] ?? [],
                'status'       => $status,
                'zone_color'   => $zoneColor,
                'zone_coating' => $zoneCoating,
                'notes'        => $zone['notes'] ?? null,
                'explanation'  => $explanation ? implode(' · ', $explanation) : 'Normal appearance',
            ];
        }

        // Bilateral edge observations (liver left / lung-GB right)
        $result['edges'] = [
            'left_edge'  => ($zones['left_edge']  ?? null) ?: null,
            'right_edge' => ($zones['right_edge'] ?? null) ?: null,
            'note'       => 'Left edge reflects liver; right edge reflects lung / gallbladder.',
        ];

        return $result;
    }

    /** Simplified heuristic used when per-zone data is missing. */
    private function fallbackBurnerStatus(string $zoneKey, array $a): string
    {
        $color    = $a['tongue_color'] ?? 'pale_red';
        $coating  = $a['coating']      ?? 'thin_white';
        $moisture = $a['moisture']     ?? 'moist';

        return match ($zoneKey) {
            'upper_jiao'  => in_array($color, ['red', 'deep_red'])                  ? 'heat'        : 'normal',
            'middle_jiao' => in_array($coating, ['yellow_greasy', 'white_greasy'])  ? 'dampness'    : 'normal',
            'lower_jiao'  => $moisture === 'slippery'                               ? 'cold_damp'   : 'normal',
            default       => 'normal',
        };
    }

    /**
     * Holographic body map (全息图) — cross-references each zone's status
     * against the 14-region fetal-posture body mapping to flag likely
     * affected organs / regions. Produces a compact list the doctor can
     * scan quickly.
     */
    private function assessHolographic(array $a): array
    {
        $zones = $a['zones'] ?? [];
        $signs = $a['signs'] ?? [];
        $flags = [];

        $register = function (string $region, string $reason) use (&$flags) {
            $flags[] = [
                'region' => $region,
                'reason' => $reason,
            ];
        };

        // Upper jiao (head/throat/heart/lungs/thyroid)
        $upper = $zones['upper_jiao'] ?? [];
        if (in_array($upper['color'] ?? null, ['red', 'deep_red'], true)
            || !empty($signs['tip_red_area'])
            || !empty($signs['upper_jiao_red_dots']) && ($signs['upper_jiao_red_dots'] ?? 'none') !== 'none'
        ) {
            $register('Head / face / brain / eyes', 'Tip or upper-jiao redness — heat rising to the head.');
            $register('Throat / tonsils', 'Upper-jiao heat may present as throat inflammation.');
            $register('Heart', 'Heart fire pattern when tip is red; may disturb shen (anxiety, insomnia).');
            $register('Lungs', 'Upper-jiao heat may involve the lung network.');
        }
        if (! empty($signs['heart_zone_depression'])) {
            $register('Heart', 'Depression in the heart zone indicates heart qi deficiency — watch for sweating.');
        }

        // Middle jiao (stomach/spleen — centre, liver — left, gallbladder/lung-descending — right)
        $middle = $zones['middle_jiao'] ?? [];
        if (in_array($middle['coating'] ?? null, ['yellow_greasy', 'white_greasy', 'white_sticky_stringy'], true)) {
            $register('Stomach / spleen', 'Greasy coating in the centre — damp accumulation in the digestive middle.');
        }
        if ($middle['color'] ?? null === 'red') {
            $register('Stomach', 'Red middle — stomach fire (may present as acid reflux, bad breath, hunger).');
        }
        if (($zones['left_edge']['color'] ?? null) === 'red' || ! empty($signs['liver_gb_swelling'])) {
            $register('Liver', 'Left-edge redness or swelling — liver qi stagnation or liver fire.');
        }
        if (($zones['right_edge']['color'] ?? null) === 'red' || ! empty($signs['liver_gb_swelling'])) {
            $register('Gallbladder / descending lung', 'Right-edge redness or swelling — gallbladder heat or lung qi failing to descend.');
        }

        // Lower jiao (kidneys / bladder / intestines / uterus / prostate)
        $lower = $zones['lower_jiao'] ?? [];
        if (! empty($signs['root_greasy_coat']) || in_array($lower['coating'] ?? null, ['yellow_greasy', 'white_greasy'], true)) {
            $register('Lower intestines / bladder', 'Root greasy coating — lower-jiao dampness; watch stool/urine signs.');
            $register('Uterus / prostate', 'Lower-jiao dampness may affect pelvic inflammation or discharge.');
        }
        if (($lower['color'] ?? null) === 'pale_white' && ($a['moisture'] ?? 'moist') === 'slippery') {
            $register('Kidneys (yang)', 'Pale wet root — kidney yang deficiency with water retention.');
        }
        if ((($a['signs']['petechiae'] ?? false)) || $a['tongue_color'] === 'purple') {
            $register('Blood / circulation', 'Purple or petechiae — systemic blood stasis; check for fixed pain.');
        }

        return [
            'description'    => 'Body regions inferred from tongue zones via the holographic map.',
            'description_zh' => '以全息图推斷可能涉及之身體部位。',
            'affected'       => $flags,
        ];
    }

    /**
     * Six-meridian zone assessment. Leans on the Huangdi Neijing 六经辨证
     * reflected on the tongue per the Yin framework. Uses per-zone colour
     * to flag patterns the doctor should consider during differentiation.
     */
    private function assessSixMeridians(array $a): array
    {
        $zones = $a['zones'] ?? [];
        $notes = [];

        $tip     = $zones['upper_jiao']['color']   ?? null;
        $tipCoat = $zones['upper_jiao']['coating'] ?? null;
        $middle  = $zones['middle_jiao']['color']  ?? null;
        $middleCoat = $zones['middle_jiao']['coating'] ?? null;
        $root    = $zones['lower_jiao']['color']   ?? null;

        if ($tip === 'red' || $tipCoat === 'thin_white') {
            $notes[] = [
                'meridian' => 'Taiyang / Shaoyin · 太陽 / 少陰',
                'zone'     => 'Tongue tip',
                'note'     => $tipCoat === 'thin_white'
                    ? 'Thin white tip — early Taiyang exterior cold or Shaoyin onset.'
                    : 'Red tip — Shaoyin heart heat or Taiyang heat-transmission.',
            ];
        }
        if (in_array($middle, ['red', 'deep_red'], true) || $middleCoat === 'yellow_dry' || $middleCoat === 'yellow_greasy') {
            $notes[] = [
                'meridian' => 'Yangming / Taiyin · 陽明 / 太陰',
                'zone'     => 'Tongue centre',
                'note'     => 'Yellow/dry or greasy centre — Yangming heat-bind or Taiyin damp-cold; differentiate by dryness vs greasiness.',
            ];
        }
        if (($zones['left_edge']['color'] ?? null) === 'red' || ! empty($a['signs']['liver_gb_swelling'])) {
            $notes[] = [
                'meridian' => 'Shaoyang / Jueyin · 少陽 / 厥陰',
                'zone'     => 'Bilateral edges',
                'note'     => 'Edge redness or swelling — Shaoyang gallbladder-heat or Jueyin liver stagnation/cold.',
            ];
        }
        if (in_array($root, ['pale_white'], true) && ($a['moisture'] ?? 'moist') === 'slippery') {
            $notes[] = [
                'meridian' => 'Shaoyin (kidney) · 少陰（腎）',
                'zone'     => 'Tongue root',
                'note'     => 'Pale wet root — Shaoyin kidney-yang deficit.',
            ];
        }

        return $notes;
    }

    /**
     * Detect specific clinical sign patterns flagged by the vision model
     * and attach formula-direction guidance from the knowledge base where
     * a mapping exists. Never returns a full prescription — only pattern
     * hints that the reviewing doctor can confirm or adjust.
     */
    private function detectClinicalPatterns(array $a): array
    {
        $signs = $a['signs'] ?? [];
        $patterns = [];

        // Upper-jiao red dots → formula mapping by extent
        $extent = $signs['upper_jiao_red_dots'] ?? 'none';
        if ($extent !== 'none') {
            $p = KnowledgeBase::CLINICAL_PATTERNS['upper_jiao_red_dots'] ?? null;
            $formula = $p['formula_mapping'][match ($extent) {
                'small'  => 'small_area_top_third',
                'medium' => 'medium_area_two_thirds',
                'full'   => 'full_upper_jiao',
                'extending_to_middle' => 'extends_to_middle',
                default  => 'small_area_top_third',
            }] ?? null;

            $patterns[] = [
                'key'         => 'upper_jiao_red_dots',
                'name_zh'     => $p['name_zh']     ?? '上焦红点',
                'name_en'     => $p['name_en']     ?? 'Upper-jiao red dots',
                'extent'      => $extent,
                'description' => $p['description'] ?? '',
                'indication'  => $p['indication']  ?? '',
                'formula'     => $formula,
            ];
        }

        // Horseshoe tongue
        if (! empty($signs['horseshoe_shape'])) {
            $p = KnowledgeBase::CLINICAL_PATTERNS['horseshoe_tongue'] ?? null;
            $patterns[] = [
                'key'         => 'horseshoe_tongue',
                'name_zh'     => $p['name_zh']     ?? '马蹄舌',
                'name_en'     => $p['name_en']     ?? 'Horseshoe tongue',
                'description' => $p['description'] ?? '',
                'indication'  => $p['indication']  ?? '',
            ];
        }

        // Root greasy coating
        if (! empty($signs['root_greasy_coat'])) {
            $p = KnowledgeBase::CLINICAL_PATTERNS['root_greasy_coat'] ?? null;
            $patterns[] = [
                'key'         => 'root_greasy_coat',
                'name_zh'     => $p['name_zh']     ?? '舌根厚腻苔',
                'name_en'     => $p['name_en']     ?? 'Greasy coating at root',
                'description' => $p['description'] ?? '',
                'indication'  => $p['indication']  ?? '',
            ];
        }

        // Tongue-tip red area
        if (! empty($signs['tip_red_area'])) {
            $p = KnowledgeBase::CLINICAL_PATTERNS['tongue_tip_red_area'] ?? null;
            $patterns[] = [
                'key'         => 'tongue_tip_red_area',
                'name_zh'     => $p['name_zh']     ?? '舌尖红色区域',
                'name_en'     => $p['name_en']     ?? 'Red area at tongue tip',
                'indication'  => $p['indication']  ?? '',
            ];
        }

        // Heart-zone depression
        if (! empty($signs['heart_zone_depression'])) {
            $p = KnowledgeBase::CLINICAL_PATTERNS['heart_area_depression'] ?? null;
            $patterns[] = [
                'key'         => 'heart_area_depression',
                'name_zh'     => $p['name_zh']     ?? '心区凹陷',
                'name_en'     => $p['name_en']     ?? 'Heart zone depression',
                'indication'  => $p['indication']  ?? '',
            ];
        }

        // Liver-GB edge swelling
        if (! empty($signs['liver_gb_swelling'])) {
            $p = KnowledgeBase::CLINICAL_PATTERNS['liver_gallbladder_swelling'] ?? null;
            $patterns[] = [
                'key'         => 'liver_gallbladder_swelling',
                'name_zh'     => $p['name_zh']     ?? '肝胆区膨隆',
                'name_en'     => $p['name_en']     ?? 'Liver-gallbladder zone swelling',
                'indication'  => $p['indication']  ?? '',
            ];
        }

        // Radiating (diabetes-type) cracks
        if (! empty($signs['radiating_cracks'])) {
            $p = KnowledgeBase::CLINICAL_PATTERNS['radiating_cracks'] ?? null;
            $patterns[] = [
                'key'         => 'radiating_cracks',
                'name_zh'     => $p['name_zh']     ?? '放射状裂纹',
                'name_en'     => $p['name_en']     ?? 'Radiating fissures',
                'indication'  => $p['indication']  ?? '',
            ];
        }

        return $patterns;
    }

    /**
     * Ascending/descending (升降) analysis — flags liver-qi-surging or
     * lung-qi-failing patterns with concrete treatment cautions and
     * direction-specific herb suggestions drawn from the knowledge base.
     */
    private function assessAscendingDescending(array $a): array
    {
        $tip      = $a['tip_elevation'] ?? 'level';
        $midline  = $a['midline']        ?? 'centered';
        $tenPrin  = KnowledgeBase::TEN_PRINCIPLES;

        if ($tip === 'left_higher' || $midline === 'shifted_right') {
            $p = $tenPrin['ascending'] ?? [];
            return [
                'direction'  => 'ascending_excess',
                'name_zh'    => '肝气上逆',
                'name_en'    => 'Liver qi ascending excess',
                'signs'      => $p['signs']   ?? 'Left side enlarged / left tip higher.',
                'caution'    => $p['caution'] ?? 'Avoid Chaihu (柴胡) — it lifts liver qi further.',
            ];
        }
        if ($tip === 'right_higher' || $midline === 'shifted_left') {
            $p = $tenPrin['descending'] ?? [];
            return [
                'direction'  => 'descending_blocked',
                'name_zh'    => '肺气不降',
                'name_en'    => 'Lung qi failing to descend',
                'signs'      => $p['signs']    ?? 'Right side enlarged / right tip higher.',
                'treatment'  => $p['treatment'] ?? 'Consider descending herbs such as Xingren (杏仁), Pipaye (枇杷叶), Zhidahuang (制大黄).',
            ];
        }

        return [
            'direction' => 'balanced',
            'note'      => 'Tip elevation balanced, midline centred — no strong ascending/descending signal on tongue.',
        ];
    }

    private function recommendations(?array $primary): array
    {
        if (! $primary) return ['Maintain balanced diet and regular exercise'];

        return match ($primary['type']) {
            'qi_deficient' => [
                'Prioritise rest and avoid overexertion',
                'Eat warm, cooked foods; favour rice porridge, yam (山药), dates',
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
                'Manage stress through meditation, deep breathing, or counselling',
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
