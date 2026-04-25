<?php

namespace App\Services\TongueAssessment;

/**
 * Structured knowledge base for AI tongue diagnosis.
 *
 * Source: 《殷氏现代舌诊原理与图谱》殷鸿春著, 2019 (People's Medical Publishing House)
 *
 * This file encodes the diagnostic classification system from the textbook
 * as structured PHP arrays that both the AI analysis pipeline and the
 * constitution-report generator can reference.
 *
 * Key innovations from Yin's Modern Tongue Diagnosis:
 *   1. Bio-holographic mapping: the body maps onto the tongue as a
 *      prone fetus (head at tip, feet at root).
 *   2. Tongue midline (舌中线) analysis for qi ascending/descending.
 *   3. Ten-principle differentiation (十纲辨证): classical 8 principles
 *      + ascending (升) and descending (降).
 *   4. Three-burner (三焦) zoning on the tongue surface.
 *   5. Six-meridian (六经) mapping to tongue regions.
 */
class KnowledgeBase
{
    // =========================================================
    // 1. TONGUE BODY COLOR (舌质/舌色)
    // =========================================================
    public const TONGUE_COLORS = [
        'pale_white' => [
            'name_zh'     => '淡白舌',
            'name_en'     => 'Pale white tongue',
            'indication'  => 'Yang deficiency, qi-blood insufficiency',
            'pattern_zh'  => '阳虚，气血不足',
            'severity'    => 'moderate',
            'heat_cold'   => 'cold',
            'deficiency_excess' => 'deficiency',
        ],
        'pale_red' => [
            'name_zh'     => '淡红舌',
            'name_en'     => 'Pale red tongue (normal)',
            'indication'  => 'Normal, balanced qi and blood',
            'pattern_zh'  => '正常，气血调和',
            'severity'    => 'normal',
            'heat_cold'   => 'neutral',
            'deficiency_excess' => 'balanced',
        ],
        'red' => [
            'name_zh'     => '红舌',
            'name_en'     => 'Red tongue',
            'indication'  => 'Heat pattern — excess heat or yin deficiency with internal heat',
            'pattern_zh'  => '热证——实热或阴虚内热',
            'severity'    => 'moderate',
            'heat_cold'   => 'hot',
            'deficiency_excess' => 'varies',
        ],
        'deep_red' => [
            'name_zh'     => '绛舌',
            'name_en'     => 'Deep crimson tongue',
            'indication'  => 'Heat has entered the nutritive (营) or blood (血) level',
            'pattern_zh'  => '热入营血',
            'severity'    => 'severe',
            'heat_cold'   => 'hot',
            'deficiency_excess' => 'excess',
        ],
        'purple' => [
            'name_zh'     => '紫舌',
            'name_en'     => 'Purple tongue',
            'indication'  => 'Blood stasis, or cold in liver/kidney channels',
            'pattern_zh'  => '瘀血阻络，或寒邪入肝肾',
            'severity'    => 'moderate',
            'heat_cold'   => 'varies',
            'deficiency_excess' => 'stasis',
        ],
        'blue_purple' => [
            'name_zh'     => '青紫舌',
            'name_en'     => 'Blue-purple tongue',
            'indication'  => 'Blood stasis with cold, or severe stagnation',
            'pattern_zh'  => '瘀血寒凝',
            'severity'    => 'severe',
            'heat_cold'   => 'cold',
            'deficiency_excess' => 'stasis',
        ],
        'dark_red_pork_kidney' => [
            'name_zh'     => '暗红如猪腰子色',
            'name_en'     => 'Dark red (pork-kidney color)',
            'indication'  => 'Kidney yang exhaustion, heart yang near collapse',
            'pattern_zh'  => '肾阳虚衰，心阳将绝',
            'severity'    => 'critical',
            'heat_cold'   => 'cold',
            'deficiency_excess' => 'deficiency',
        ],
    ];

    // =========================================================
    // 2. TONGUE COATING (舌苔)
    // =========================================================
    public const TONGUE_COATINGS = [
        'thin_white' => [
            'name_zh'    => '薄白苔',
            'name_en'    => 'Thin white coating',
            'indication' => 'Normal; or early exterior cold pattern',
            'pattern_zh' => '正常；或表寒证初期',
            'heat_cold'  => 'neutral',
        ],
        'white_greasy' => [
            'name_zh'    => '白腻苔',
            'name_en'    => 'White greasy coating',
            'indication' => 'Dampness-cold, phlegm retention, Taiyin dampness-turbidity',
            'pattern_zh' => '寒湿，痰饮，太阴湿浊不化',
            'heat_cold'  => 'cold',
        ],
        'white_like_powder' => [
            'name_zh'    => '苔如积粉',
            'name_en'    => 'Powder-like white coating',
            'indication' => 'Pathogen lodged in the membrane source (膜原)',
            'pattern_zh' => '邪伏膜原',
            'heat_cold'  => 'mixed',
        ],
        'white_sticky_stringy' => [
            'name_zh'    => '白黏腻拉丝',
            'name_en'    => 'White sticky / stringy coating',
            'indication' => 'Dampness-turbidity requiring aromatic transformation',
            'pattern_zh' => '湿浊，宜芳化祛湿',
            'heat_cold'  => 'cold',
        ],
        'white_dry' => [
            'name_zh'    => '白燥苔',
            'name_en'    => 'White dry coating',
            'indication' => 'Dryness pathogen; or exterior cold with dryness',
            'pattern_zh' => '燥邪为患',
            'heat_cold'  => 'varies',
        ],
        'yellow_thin' => [
            'name_zh'    => '薄黄苔',
            'name_en'    => 'Thin yellow coating',
            'indication' => 'Early interior heat pattern',
            'pattern_zh' => '里热初起',
            'heat_cold'  => 'hot',
        ],
        'yellow_greasy' => [
            'name_zh'    => '黄腻苔',
            'name_en'    => 'Yellow greasy coating',
            'indication' => 'Dampness-heat accumulation',
            'pattern_zh' => '湿热蕴结',
            'heat_cold'  => 'hot',
        ],
        'yellow_dry' => [
            'name_zh'    => '黄燥苔',
            'name_en'    => 'Yellow dry coating',
            'indication' => 'Interior excess heat consuming fluids',
            'pattern_zh' => '里实热，津液耗伤',
            'heat_cold'  => 'hot',
        ],
        'grey_moist' => [
            'name_zh'    => '灰润苔',
            'name_en'    => 'Grey moist coating',
            'indication' => 'Kidney yang deficiency with internal cold',
            'pattern_zh' => '肾阳虚，内寒',
            'heat_cold'  => 'cold',
        ],
        'black_moist' => [
            'name_zh'    => '黑润苔',
            'name_en'    => 'Black moist coating',
            'indication' => 'Kidney yang deficiency, severe internal cold',
            'pattern_zh' => '肾阳虚，内寒重',
            'heat_cold'  => 'cold',
        ],
        'black_dry' => [
            'name_zh'    => '黑干苔',
            'name_en'    => 'Black dry coating',
            'indication' => 'Extreme interior heat; or water exhaustion with fire dominance',
            'pattern_zh' => '里热已极；或水亏火旺',
            'heat_cold'  => 'hot',
        ],
        'peeled_no_coating' => [
            'name_zh'    => '剥苔/无苔',
            'name_en'    => 'Peeled / no coating',
            'indication' => 'Yin deficiency; stomach qi/yin damaged',
            'pattern_zh' => '阴虚，胃气胃阴受损',
            'heat_cold'  => 'hot',
        ],
    ];

    // =========================================================
    // 3. TONGUE SHAPE (舌形)
    // =========================================================
    public const TONGUE_SHAPES = [
        'normal' => [
            'name_zh'    => '正常舌形',
            'name_en'    => 'Normal shape',
            'indication' => 'Balanced qi and blood',
        ],
        'swollen' => [
            'name_zh'    => '胖大舌',
            'name_en'    => 'Swollen / enlarged',
            'indication' => 'Yang deficiency with fluid retention; or blood heat (if red)',
            'pattern_zh' => '阳虚水湿停留；若红则血热',
        ],
        'thin_small' => [
            'name_zh'    => '瘦小舌',
            'name_en'    => 'Thin / small',
            'indication' => 'Qi-blood deficiency; or yin deficiency',
            'pattern_zh' => '气血两虚；或阴虚',
        ],
        'teeth_marks' => [
            'name_zh'    => '齿痕舌',
            'name_en'    => 'Teeth-marked',
            'indication' => 'Spleen qi deficiency, dampness retention',
            'pattern_zh' => '脾气虚，水湿内停',
        ],
        'stiff' => [
            'name_zh'    => '舌强/舌硬',
            'name_en'    => 'Stiff tongue',
            'indication' => 'Heat damaging body fluids; wind-phlegm blocking collaterals; wind-stroke prodrome',
            'pattern_zh' => '热伤津液；风痰阻络；中风先兆',
        ],
        'deviated' => [
            'name_zh'    => '歪斜舌',
            'name_en'    => 'Deviated tongue',
            'indication' => 'Wind-stroke (active or impending)',
            'pattern_zh' => '中风已发或将发',
        ],
        'pillar_shaped' => [
            'name_zh'    => '柱状舌',
            'name_en'    => 'Pillar-shaped tongue',
            'indication' => 'Liver qi surging upward; seen in epilepsy',
            'pattern_zh' => '肝气上冲，见于癫痫',
        ],
    ];

    // =========================================================
    // 4. TONGUE MOISTURE (润燥)
    // =========================================================
    public const TONGUE_MOISTURE = [
        'moist' => [
            'name_zh'    => '润泽',
            'name_en'    => 'Moist / lustrous',
            'indication' => 'Normal body fluids; or yang deficiency (if pale)',
            'pattern_zh' => '津液充足；或阳虚（舌淡时）',
        ],
        'dry' => [
            'name_zh'    => '干燥',
            'name_en'    => 'Dry',
            'indication' => 'Yin deficiency with fluid loss; or yang deficiency failing to distribute fluids',
            'pattern_zh' => '阴虚津液亏损；或阳虚失于蒸化',
        ],
        'slippery' => [
            'name_zh'    => '滑',
            'name_en'    => 'Slippery / excessively wet',
            'indication' => 'Water-dampness retention; yang deficiency',
            'pattern_zh' => '水湿内停，阳虚',
        ],
    ];

    // =========================================================
    // 5. MIDLINE ANALYSIS (舌中线) — Yin's key innovation
    // =========================================================
    public const MIDLINE_PATTERNS = [
        'centered' => [
            'name_zh'    => '中线居中',
            'name_en'    => 'Centered midline',
            'indication' => 'Balanced liver-ascending / lung-descending qi mechanism',
            'pattern_zh' => '肝升肺降气机平衡',
        ],
        'shifted_right' => [
            'name_zh'    => '中线右偏',
            'name_en'    => 'Midline shifted right',
            'indication' => 'Left tongue larger → liver qi stagnation (liver excess, lung deficiency). "East excess, west deficiency" (东方实,西方虚)',
            'pattern_zh' => '左舌大右舌小，肝实肺虚，肝木侮肺金，脾土虚馁',
            'symptoms'   => ['irritability', 'hypochondriac_distention', 'poor_appetite', 'abdominal_bloating', 'diarrhea', 'cough', 'shortness_of_breath'],
        ],
        'shifted_left' => [
            'name_zh'    => '中线左偏',
            'name_en'    => 'Midline shifted left',
            'indication' => 'Right tongue larger → lung qi stagnation (lung excess, liver deficiency). Metal overwhelming wood.',
            'pattern_zh' => '右舌大左舌小，肺实肝虚，金乘木',
            'symptoms'   => ['chest_tightness', 'cough_wheeze', 'constipation', 'dry_eyes', 'blurred_vision', 'sadness_depression'],
        ],
        'segmental_curve' => [
            'name_zh'    => '中线某段侧弯',
            'name_en'    => 'Segmental curve in midline',
            'indication' => 'Spinal misalignment, scoliosis, or internal organ displacement at corresponding level',
            'pattern_zh' => '脊柱错位/侧弯，或局部脏器肿大偏位',
        ],
        'local_protrusion' => [
            'name_zh'    => '中线凸起/点状凸起',
            'name_en'    => 'Midline protrusion',
            'indication' => 'Qi mechanism blocked at that level (tumor, local organ qi stagnation)',
            'pattern_zh' => '局部气机被阻（肿瘤、局部脏器气机郁滞）',
        ],
        'local_depression' => [
            'name_zh'    => '中线凹陷',
            'name_en'    => 'Midline depression',
            'indication' => 'Qi-blood deficiency at that level (middle qi sinking, surgical scar, organ removal)',
            'pattern_zh' => '局部气血亏虚（中气下陷、手术瘢痕、脏器切除）',
        ],
        'oblique_deviation' => [
            'name_zh'    => '中线歪斜（舌尖/舌体偏向一侧）',
            'name_en'    => 'Oblique midline deviation',
            'indication' => 'Wind-stroke active or impending',
            'pattern_zh' => '中风已发或将发',
        ],
        'fissures_on_midline' => [
            'name_zh'    => '中线裂纹',
            'name_en'    => 'Fissures along midline',
            'indication' => 'Spinal / Du-mai (督脉) problems. Location maps: tip→cervical, mid→thoracic, root→lumbar/sacral',
            'pattern_zh' => '督脉为病，脊柱病变',
        ],
    ];

    // =========================================================
    // 6. THREE-BURNER ZONING (三焦分区)
    // =========================================================
    public const THREE_BURNER_ZONES = [
        'upper_jiao' => [
            'name_zh'    => '上焦',
            'name_en'    => 'Upper Jiao (upper burner)',
            'tongue_area'=> 'Tongue tip to ~1/3 from tip',
            'organs'     => ['head', 'brain', 'eyes', 'ears', 'nose', 'throat', 'lungs', 'heart', 'thyroid', 'tonsils', 'pituitary'],
            'boundary'   => 'Zhongting (中庭) / Zhiyang (至阳)',
        ],
        'middle_jiao' => [
            'name_zh'    => '中焦',
            'name_en'    => 'Middle Jiao (middle burner)',
            'tongue_area'=> 'Middle 1/3 of tongue',
            'organs'     => ['stomach', 'spleen', 'liver', 'gallbladder', 'diaphragm'],
            'boundary'   => 'Between Zhongting and navel (神阙/命门)',
            'sides'      => 'Left side = liver; Right side = lung/gallbladder',
        ],
        'lower_jiao' => [
            'name_zh'    => '下焦',
            'name_en'    => 'Lower Jiao (lower burner)',
            'tongue_area'=> 'Posterior 1/3 to root',
            'organs'     => ['kidneys', 'bladder', 'intestines', 'uterus', 'prostate', 'ovaries', 'rectum'],
        ],
    ];

    // =========================================================
    // 7. HOLOGRAPHIC BODY MAP (全息图)
    // =========================================================
    public const HOLOGRAPHIC_MAP = [
        'description' => 'The body appears as a prone fetus with raised head on the tongue surface',
        'description_zh' => '人体在舌上呈昂头前视俯卧的胎儿像',
        'mapping' => [
            'tongue_tip'          => 'Head, face, eyes, nose, ears, throat',
            'tongue_tip_sides'    => 'Shoulders, wrists, hands',
            'upper_third'         => 'Lungs, heart, thyroid, tonsils, pituitary (glands at tip-edge)',
            'middle_left'         => 'Liver',
            'middle_right'        => 'Gallbladder, lung (descending function)',
            'middle_center'       => 'Stomach, spleen',
            'tongue_edges'        => 'Four limbs in flexed position (elbow and knee adjacent)',
            'lower_third'         => 'Kidneys, bladder, intestines',
            'tongue_root'         => 'Rectum, uterus/prostate',
            'tongue_root_sides'   => 'Hips, ankles, feet, ovaries/testes',
            'midline'             => 'Spine (Du-mai / governing vessel)',
        ],
    ];

    // =========================================================
    // 8. SIX-MERIDIAN MAPPING (六经辨证舌区)
    // =========================================================
    public const SIX_MERIDIAN_ZONES = [
        'taiyang_shaoyin' => [
            'name_zh'     => '太阳-少阴',
            'tongue_zone' => 'Upper and lower jiao (tip + root)',
            'note'        => 'Exterior patterns show at tip; deep cold/kidney patterns at root',
        ],
        'shaoyang_jueyin' => [
            'name_zh'     => '少阳-厥阴',
            'tongue_zone' => 'Middle jiao, bilateral sides',
            'note'        => 'Liver-gallbladder pathology shows as bilateral swelling or color change',
        ],
        'yangming_taiyin' => [
            'name_zh'     => '阳明-太阴',
            'tongue_zone' => 'Middle jiao, central area',
            'note'        => 'Stomach/spleen patterns in the center of the tongue body',
        ],
    ];

    // =========================================================
    // 9. TEN-PRINCIPLE DIFFERENTIATION (十纲辨证)
    // =========================================================
    public const TEN_PRINCIPLES = [
        'yin_yang' => [
            'name_zh' => '阴阳',
            'yin'     => 'Pale, swollen, moist, teeth-marked → yang deficiency',
            'yang'    => 'Red, dry, thin → yin deficiency / heat excess',
        ],
        'exterior_interior' => [
            'name_zh'   => '表里',
            'exterior'  => 'Thin white coating → exterior cold (taiyang)',
            'interior'  => 'Yellow/grey/black coating, body color changes → interior pattern',
        ],
        'cold_heat' => [
            'name_zh' => '寒热',
            'cold'    => 'Pale/blue-purple body, moist/greasy white coating, swollen',
            'heat'    => 'Red/crimson body, yellow/dry coating, thin body',
        ],
        'deficiency_excess' => [
            'name_zh'    => '虚实',
            'deficiency' => 'Pale, swollen, teeth-marked, thin white coat',
            'excess'     => 'Thick coat, yellow/dry/black, firm texture',
        ],
        'ascending' => [
            'name_zh'   => '升',
            'indicator' => 'Left tongue tip higher than right → liver qi surging upward',
            'signs'     => 'Left side enlarged, left tip protruding',
            'caution'   => 'Caution with Chaihu (柴胡) when left tip is visibly higher — it lifts liver qi further',
        ],
        'descending' => [
            'name_zh'   => '降',
            'indicator' => 'Right tongue tip higher than left → lung qi failing to descend',
            'signs'     => 'Right side enlarged, right tip protruding, upper jiao enlarged',
            'treatment' => 'Use descending herbs: Xingren (杏仁), Pipaye (枇杷叶), Zhidahuang (制大黄)',
        ],
    ];

    // =========================================================
    // 10. CLINICAL SIGN PATTERNS
    // =========================================================
    public const CLINICAL_PATTERNS = [
        'horseshoe_tongue' => [
            'name_zh'     => '马蹄舌',
            'name_en'     => 'Horseshoe tongue',
            'description' => 'Upper jiao and bilateral edges raised, center depressed — like a horseshoe shape',
            'indication'  => 'Bilateral qi stagnation affecting ascending and descending, upper jiao heat with dampness',
        ],
        'upper_jiao_red_dots' => [
            'name_zh'     => '上焦红点',
            'name_en'     => 'Upper jiao red dots',
            'description' => 'Red dots or prickles on the tongue tip area',
            'indication'  => 'Upper jiao heat: head/face inflammation, anxiety, or skin disease on scalp',
            'formula_mapping' => [
                'small_area_top_third'  => 'Bohe (薄荷) + Lianzi-xin (莲子心)',
                'medium_area_two_thirds' => 'Add Lianqiao (连翘) + Jinyinhua (金银花)',
                'full_upper_jiao'        => 'Full Yinqiao-san (银翘散)',
                'extends_to_middle'      => 'Add Yangming heat-clearing herbs',
            ],
        ],
        'root_greasy_coat' => [
            'name_zh'     => '舌根厚腻苔',
            'name_en'     => 'Greasy coating at root',
            'description' => 'Thick greasy coating concentrated at tongue root',
            'indication'  => 'Lower jiao dampness; constipation/stool issues; or pelvic/urogenital inflammation',
        ],
        'radiating_cracks' => [
            'name_zh'     => '放射状裂纹',
            'name_en'     => 'Radiating fissures',
            'description' => 'Fissures spreading outward like dry cracked earth',
            'indication'  => 'Classic diabetes tongue pattern — yin-yang both deficient',
        ],
        'tongue_tip_red_area' => [
            'name_zh'     => '舌尖红色区域',
            'name_en'     => 'Red area at tongue tip',
            'description' => 'Red coloration concentrated at the tip',
            'indication'  => 'Heart fire; anxiety/insomnia; or head/face inflammation',
        ],
        'heart_area_depression' => [
            'name_zh'     => '心区凹陷',
            'name_en'     => 'Heart zone depression',
            'description' => 'Depression in the upper-jiao heart area of tongue',
            'indication'  => 'Heart qi deficiency; may present with excessive sweating (心主汗)',
        ],
        'liver_gallbladder_swelling' => [
            'name_zh'     => '肝胆区膨隆',
            'name_en'     => 'Liver-gallbladder zone swelling',
            'description' => 'Bilateral swelling in the middle jiao side zones',
            'indication'  => 'Liver-gallbladder qi stagnation; Jueyin liver-cold or Shaoyang gallbladder-heat',
        ],
    ];

    // =========================================================
    // 11. CONSTITUTION TYPES (体质类型)
    // =========================================================
    public const CONSTITUTION_TYPES = [
        'balanced' => [
            'name_zh' => '平和体质',
            'name_en' => 'Balanced constitution',
            'tongue'  => 'Pale red, thin white coat, moist, midline centered, no teeth marks',
        ],
        'qi_deficient' => [
            'name_zh' => '气虚体质',
            'name_en' => 'Qi-deficient constitution',
            'tongue'  => 'Pale, swollen with teeth marks, thin white coat, midline may show depression',
            'risks'   => ['fatigue', 'spontaneous_sweating', 'shortness_of_breath', 'poor_appetite'],
        ],
        'yang_deficient' => [
            'name_zh' => '阳虚体质',
            'name_en' => 'Yang-deficient constitution',
            'tongue'  => 'Pale, swollen, moist/slippery, white greasy coat, especially lower jiao',
            'risks'   => ['cold_limbs', 'loose_stools', 'frequent_urination', 'low_back_pain'],
        ],
        'yin_deficient' => [
            'name_zh' => '阴虚体质',
            'name_en' => 'Yin-deficient constitution',
            'tongue'  => 'Red, thin/small, little or no coating, dry, possible fissures',
            'risks'   => ['night_sweats', 'dry_mouth', 'insomnia', 'heat_in_palms_soles'],
        ],
        'phlegm_dampness' => [
            'name_zh' => '痰湿体质',
            'name_en' => 'Phlegm-dampness constitution',
            'tongue'  => 'Swollen, thick white greasy coat, slippery',
            'risks'   => ['obesity', 'heavy_head', 'chest_tightness', 'loose_stools'],
        ],
        'damp_heat' => [
            'name_zh' => '湿热体质',
            'name_en' => 'Damp-heat constitution',
            'tongue'  => 'Red, yellow greasy coat, especially middle and lower jiao',
            'risks'   => ['acne', 'bitter_taste', 'foul_stools', 'dark_urine'],
        ],
        'blood_stasis' => [
            'name_zh' => '血瘀体质',
            'name_en' => 'Blood-stasis constitution',
            'tongue'  => 'Purple/dark, possible petechiae (瘀斑), sublingual veins engorged',
            'risks'   => ['fixed_pain', 'dark_complexion', 'prone_to_masses'],
        ],
        'qi_stagnation' => [
            'name_zh' => '气郁体质',
            'name_en' => 'Qi-stagnation constitution',
            'tongue'  => 'Midline shifted (usually right), left side enlarged, may have string-like coating',
            'risks'   => ['depression', 'mood_swings', 'sighing', 'hypochondriac_pain', 'insomnia'],
        ],
    ];

    // =========================================================
    // PUBLIC API
    // =========================================================

    /** Get all diagnostic categories as a structured array for AI prompt context */
    public static function getFullSchema(): array
    {
        return [
            'tongue_colors'      => self::TONGUE_COLORS,
            'tongue_coatings'    => self::TONGUE_COATINGS,
            'tongue_shapes'      => self::TONGUE_SHAPES,
            'tongue_moisture'    => self::TONGUE_MOISTURE,
            'midline_patterns'   => self::MIDLINE_PATTERNS,
            'three_burner_zones' => self::THREE_BURNER_ZONES,
            'holographic_map'    => self::HOLOGRAPHIC_MAP,
            'six_meridian_zones' => self::SIX_MERIDIAN_ZONES,
            'ten_principles'     => self::TEN_PRINCIPLES,
            'clinical_patterns'  => self::CLINICAL_PATTERNS,
            'constitution_types' => self::CONSTITUTION_TYPES,
        ];
    }

    /** Look up a constitution type by key */
    public static function getConstitutionType(string $key): ?array
    {
        return self::CONSTITUTION_TYPES[$key] ?? null;
    }

    /** Given an analysis result, map to the best-matching constitution(s) */
    public static function matchConstitutions(array $analysis): array
    {
        $matches = [];

        $color   = $analysis['tongue_color'] ?? null;
        $coating = $analysis['coating']      ?? null;
        $shape   = $analysis['shape']        ?? null;
        $teeth   = $analysis['teeth_marks']  ?? false;
        $cracks  = $analysis['cracks']       ?? false;
        $moisture = $analysis['moisture']    ?? null;

        // Qi deficiency
        if ($color === 'pale_white' && $teeth) {
            $matches[] = ['type' => 'qi_deficient', 'confidence' => 0.8];
        }
        // Yang deficiency
        if ($color === 'pale_white' && $moisture === 'slippery' && in_array($coating, ['white_greasy', 'thin_white'])) {
            $matches[] = ['type' => 'yang_deficient', 'confidence' => 0.7];
        }
        // Yin deficiency
        if (in_array($color, ['red', 'deep_red']) && $moisture === 'dry' && in_array($coating, ['peeled_no_coating', null])) {
            $matches[] = ['type' => 'yin_deficient', 'confidence' => 0.8];
        }
        // Phlegm-dampness
        if ($shape === 'swollen' && in_array($coating, ['white_greasy', 'white_sticky_stringy'])) {
            $matches[] = ['type' => 'phlegm_dampness', 'confidence' => 0.7];
        }
        // Damp-heat
        if (in_array($color, ['red', 'pale_red']) && in_array($coating, ['yellow_greasy', 'yellow_dry'])) {
            $matches[] = ['type' => 'damp_heat', 'confidence' => 0.7];
        }
        // Blood stasis
        if (in_array($color, ['purple', 'blue_purple'])) {
            $matches[] = ['type' => 'blood_stasis', 'confidence' => 0.8];
        }
        // Qi stagnation (needs midline data)
        if (isset($analysis['midline']) && in_array($analysis['midline'], ['shifted_right', 'shifted_left'])) {
            $matches[] = ['type' => 'qi_stagnation', 'confidence' => 0.7];
        }

        // Balanced if nothing flagged
        if (empty($matches) && $color === 'pale_red' && $coating === 'thin_white') {
            $matches[] = ['type' => 'balanced', 'confidence' => 0.9];
        }

        // Sort by confidence descending
        usort($matches, fn($a, $b) => $b['confidence'] <=> $a['confidence']);

        // Enrich with full constitution data
        foreach ($matches as &$m) {
            $m['details'] = self::getConstitutionType($m['type']);
        }

        return $matches;
    }
}
