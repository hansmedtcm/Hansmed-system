<?php

namespace App\Services\WellnessAssessment;

/**
 * Curated TCM pattern-confirmation question bank.
 *
 * Used by the tongue-led adaptive AI Wellness Assessment (v3):
 *   1. Patient uploads tongue photo
 *   2. AnthropicTongueClient returns 1-2 umbrella patterns + signs
 *   3. A second Claude call picks the most-fitting specific syndrome
 *      (SY01-SY31 from reference/tcm-data-tier1.xlsx) for each top
 *      umbrella pattern, then selects 3-4 questions from the matching
 *      bank entries using the tongue's specific signs as a filter
 *   4. Patient answers ~6-8 yes/no/sometimes + scale questions
 *   5. Final wellness report combines tongue + answers
 *
 * Source attribution for each syndrome entry:
 *   - Clinical signs grounded in 《中医证候鉴别诊断学》第二版
 *     (TCM Syndrome Pattern Differential Diagnosis, 2nd ed, 2002)
 *     by 姚乃礼 / 中国中医研究院, 人民卫生出版社
 *   - Cross-referenced against tier-1 dataset (Syndromes sheet of
 *     reference/tcm-data-tier1.xlsx) for syndrome IDs + standard
 *     primary/secondary symptom lists
 *
 * Question selection logic (NOT in this file — see the controller):
 *   - Each question has a `tongue_signs` array. If the tongue analysis
 *     surfaced one of those signs, the question gets a +1 priority boost
 *     in the AI's selection.
 *   - `weight` is the clinical importance of the question for
 *     confirming the syndrome — `high` questions are surfaced first.
 *   - `response_type`:
 *       'yes_no_sometimes' — patient picks Yes / Sometimes / No
 *       'scale_1_5'         — 1 (never/none) → 5 (always/severe)
 *
 * To add a new syndrome later: append an entry keyed by its SY-ID,
 * matching the schema in QUESTIONS below. The frontend will pick it
 * up automatically as long as the SY-ID is also present in the
 * tier-1 dataset.
 */
class PatternQuestionBank
{
    /**
     * Map from tongue umbrella pattern (returned by AnthropicTongueClient)
     * to candidate syndrome IDs. The AI selector picks the most-fitting
     * specific SY from these candidates based on tongue signs.
     *
     * Order matters — the AI is told to prefer the first match when
     * tongue signs are ambiguous. Most specific / most-common-in-Malaysian-
     * TCM-practice goes first.
     */
    public const PATTERN_TO_SYNDROMES = [
        'qi_deficiency'    => ['SY13', 'SY18', 'SY15', 'SY29'],   // 脾气虚 → 肺气虚 → 中气下陷 → 心脾两虚
        'blood_deficiency' => ['SY11', 'SY10', 'SY25'],            // 心血虚 → 肝血虚 → 气血两虚
        'yin_deficiency'   => ['SY23', 'SY12', 'SY16', 'SY19', 'SY24'], // 肾阴虚 → 心阴虚 → 胃阴虚 → 肺阴虚 → 肾阴虚火旺
        'yang_deficiency'  => ['SY22', 'SY14'],                    // 肾阳虚 → 脾阳虚
        'heat'             => ['SY08', 'SY09', 'SY04', 'SY21'],    // 肝郁化火 → 肝阳上亢 → 阳明腑实 → 风热犯肺
        'damp_heat'        => ['SY27', 'SY28'],                    // 湿热下注 → 湿热中焦
        'dampness'         => ['SY26'],                            // 痰湿内蕴
        'cold_damp'        => ['SY14', 'SY05'],                    // 脾阳虚 → 太阴虚寒
        'deficiency_cold'  => ['SY22', 'SY06'],                    // 肾阳虚 → 少阴寒化
        'stasis'           => ['SY31'],                            // 血瘀
        'normal'           => [],                                  // no questions — tongue says you're fine
    ];

    /**
     * The actual question bank, keyed by syndrome ID. Each entry has:
     *   - name_en, name_zh       : human-readable syndrome name
     *   - tongue_signs           : tongue features that strongly suggest
     *                              this syndrome over other candidates
     *                              within the same umbrella pattern
     *   - questions[]            : 5+ candidate questions; the AI picks
     *                              3-4 based on the tongue's actual signs
     *                              + clinical_weight ranking
     */
    public const QUESTIONS = [

        // ═══════════════════════════════════════════════════════════
        // Qi Deficiency umbrella
        // ═══════════════════════════════════════════════════════════

        'SY13' => [
            'name_en'        => 'Spleen Qi Deficiency',
            'name_zh'        => '脾气虚证',
            'umbrella'       => 'qi_deficiency',
            'tongue_signs'   => ['pale', 'tooth_marks', 'thin_white_coat', 'swollen'],
            'source_chapter' => '中医证候鉴别诊断学 第1章 气虚证 / 第216章 胃气虚证',
            'questions' => [
                [
                    'id'             => 'sy13-q1',
                    'text_en'        => 'Do you feel bloated or sluggish after eating, even after a light meal?',
                    'text_zh'        => '饭后即使吃得不多，也会觉得腹胀或困倦吗？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['tooth_marks', 'swollen'],
                ],
                [
                    'id'             => 'sy13-q2',
                    'text_en'        => 'Are your stools often loose or unformed?',
                    'text_zh'        => '大便经常稀烂、不成形吗？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale', 'swollen'],
                ],
                [
                    'id'             => 'sy13-q3',
                    'text_en'        => 'How often do you feel tired or short of breath after light activity?',
                    'text_zh'        => '稍微活动就觉得疲倦或气短的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy13-q4',
                    'text_en'        => 'Do you have a poor appetite or feel disinterested in food?',
                    'text_zh'        => '食欲不振，对食物提不起兴趣？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale', 'tooth_marks'],
                ],
                [
                    'id'             => 'sy13-q5',
                    'text_en'        => 'Do you sweat easily without exertion (especially during the day)?',
                    'text_zh'        => '没有运动也容易出汗（尤其白天）？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
            ],
        ],

        'SY18' => [
            'name_en'        => 'Lung Qi Deficiency',
            'name_zh'        => '肺气虚证',
            'umbrella'       => 'qi_deficiency',
            'tongue_signs'   => ['pale', 'thin_white_coat'],
            'source_chapter' => '中医证候鉴别诊断学 第213章 肺气虚证',
            'questions' => [
                [
                    'id'             => 'sy18-q1',
                    'text_en'        => 'Is your voice weak or do you find yourself talking softly without meaning to?',
                    'text_zh'        => '说话声音低微，或不自觉地说话很轻？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy18-q2',
                    'text_en'        => 'Do you catch colds easily — more than other people you know?',
                    'text_zh'        => '比身边的人更容易感冒？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale', 'thin_white_coat'],
                ],
                [
                    'id'             => 'sy18-q3',
                    'text_en'        => 'How often are you short of breath after climbing stairs or light exercise?',
                    'text_zh'        => '上楼梯或轻度运动后气短的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy18-q4',
                    'text_en'        => 'Do you sweat without exertion (spontaneous sweating)?',
                    'text_zh'        => '不活动也容易自汗？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy18-q5',
                    'text_en'        => 'Do you have a dry cough that comes and goes without obvious cause?',
                    'text_zh'        => '有时会无端干咳？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['thin_white_coat'],
                ],
            ],
        ],

        // ═══════════════════════════════════════════════════════════
        // Blood Deficiency umbrella
        // ═══════════════════════════════════════════════════════════

        'SY11' => [
            'name_en'        => 'Heart Blood Deficiency',
            'name_zh'        => '心血虚证',
            'umbrella'       => 'blood_deficiency',
            'tongue_signs'   => ['pale', 'thin', 'thin_white_coat'],
            'source_chapter' => '中医证候鉴别诊断学 第118章 心血虚证 + 第7章 血虚证',
            'questions' => [
                [
                    'id'             => 'sy11-q1',
                    'text_en'        => 'Do you have heart palpitations or notice your heartbeat unexpectedly?',
                    'text_zh'        => '会突然感觉到心跳，或心悸不安？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy11-q2',
                    'text_en'        => 'How often do you have difficulty falling asleep, or have vivid dreams that wake you?',
                    'text_zh'        => '入睡困难或多梦易醒的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale', 'thin'],
                ],
                [
                    'id'             => 'sy11-q3',
                    'text_en'        => 'Do you feel forgetful or have trouble concentrating recently?',
                    'text_zh'        => '最近健忘或难以集中注意力？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy11-q4',
                    'text_en'        => 'Is your complexion paler than it used to be, or do your lips look pale?',
                    'text_zh'        => '面色比以前苍白，或嘴唇颜色淡？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy11-q5',
                    'text_en'        => 'Do you feel dizzy when standing up too quickly?',
                    'text_zh'        => '突然站起会觉得头晕眼花？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
            ],
        ],

        'SY10' => [
            'name_en'        => 'Liver Blood Deficiency',
            'name_zh'        => '肝血虚证',
            'umbrella'       => 'blood_deficiency',
            'tongue_signs'   => ['pale', 'thin'],
            'source_chapter' => '中医证候鉴别诊断学 第134章 肝血虚证',
            'questions' => [
                [
                    'id'             => 'sy10-q1',
                    'text_en'        => 'Do your eyes feel dry, gritty, or do you have blurry vision?',
                    'text_zh'        => '眼睛干涩或视物模糊？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy10-q2',
                    'text_en'        => 'Do you experience numbness or tingling in your hands and feet?',
                    'text_zh'        => '手脚有麻木或刺痛感？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy10-q3',
                    'text_en'        => '(Women) Are your periods light, short, or have they become irregular?',
                    'text_zh'        => '（女性）月经量少、经期短，或不规律？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy10-q4',
                    'text_en'        => 'Do your nails look brittle or have ridges?',
                    'text_zh'        => '指甲容易折断或表面有竖纹？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy10-q5',
                    'text_en'        => 'Do you get muscle cramps, especially at night?',
                    'text_zh'        => '会抽筋，尤其晚上？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
            ],
        ],

        // ═══════════════════════════════════════════════════════════
        // Yin Deficiency umbrella
        // ═══════════════════════════════════════════════════════════

        'SY23' => [
            'name_en'        => 'Kidney Yin Deficiency',
            'name_zh'        => '肾阴虚证',
            'umbrella'       => 'yin_deficiency',
            'tongue_signs'   => ['red', 'peeled_root', 'cracked', 'dry'],
            'source_chapter' => '中医证候鉴别诊断学 第15章 阴虚证 + 第14章 阴虚津亏证',
            'questions' => [
                [
                    'id'             => 'sy23-q1',
                    'text_en'        => 'Do you have soreness or weakness in your lower back or knees?',
                    'text_zh'        => '腰膝酸软或无力？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['peeled_root', 'red'],
                ],
                [
                    'id'             => 'sy23-q2',
                    'text_en'        => 'Do you wake up at night sweating, especially the chest, neck, or palms?',
                    'text_zh'        => '晚上盗汗，尤其胸口、颈部或手心？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['red', 'dry'],
                ],
                [
                    'id'             => 'sy23-q3',
                    'text_en'        => 'How often do you feel a warm or burning sensation in the palms, soles, or chest (五心烦热)?',
                    'text_zh'        => '手心、脚心、胸口有发热感的频率（五心烦热）？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['red', 'cracked'],
                ],
                [
                    'id'             => 'sy23-q4',
                    'text_en'        => 'Is your mouth or throat dry, especially at night?',
                    'text_zh'        => '口干或咽干，尤其晚上？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['dry', 'peeled_root'],
                ],
                [
                    'id'             => 'sy23-q5',
                    'text_en'        => 'Do you have ringing in your ears (tinnitus) or hearing that feels muffled?',
                    'text_zh'        => '耳鸣或听力变差？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['peeled_root'],
                ],
            ],
        ],

        'SY12' => [
            'name_en'        => 'Heart Yin Deficiency',
            'name_zh'        => '心阴虚证',
            'umbrella'       => 'yin_deficiency',
            'tongue_signs'   => ['red_tip', 'red', 'peeled', 'cracked'],
            'source_chapter' => '中医证候鉴别诊断学 第119章 心阴虚证',
            'questions' => [
                [
                    'id'             => 'sy12-q1',
                    'text_en'        => 'Do you have heart palpitations together with anxiety or restlessness?',
                    'text_zh'        => '心悸伴随心烦或不安？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['red_tip', 'red'],
                ],
                [
                    'id'             => 'sy12-q2',
                    'text_en'        => 'How often do you have insomnia with vivid dreams?',
                    'text_zh'        => '失眠多梦的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['red_tip', 'peeled'],
                ],
                [
                    'id'             => 'sy12-q3',
                    'text_en'        => 'Do you have recurring mouth ulcers (canker sores)?',
                    'text_zh'        => '反复口腔溃疡？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['red_tip'],
                ],
                [
                    'id'             => 'sy12-q4',
                    'text_en'        => 'Do you sweat at night around your chest area specifically?',
                    'text_zh'        => '晚上胸口部位特别容易出汗？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['red_tip', 'peeled'],
                ],
                [
                    'id'             => 'sy12-q5',
                    'text_en'        => 'Do you feel hot easily, especially in the afternoon or evening?',
                    'text_zh'        => '午后或傍晚容易潮热？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['red', 'red_tip'],
                ],
            ],
        ],

        // ═══════════════════════════════════════════════════════════
        // Yang Deficiency umbrella
        // ═══════════════════════════════════════════════════════════

        'SY22' => [
            'name_en'        => 'Kidney Yang Deficiency',
            'name_zh'        => '肾阳虚证',
            'umbrella'       => 'yang_deficiency',
            'tongue_signs'   => ['pale', 'swollen', 'wet', 'white_coat'],
            'source_chapter' => '中医证候鉴别诊断学 第16章 阳虚证 + 肾阳虚相关章节',
            'questions' => [
                [
                    'id'             => 'sy22-q1',
                    'text_en'        => 'Are your hands and feet cold, even in warm weather?',
                    'text_zh'        => '手脚冰凉，即使天气暖和？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale', 'wet'],
                ],
                [
                    'id'             => 'sy22-q2',
                    'text_en'        => 'Do you have a cold or aching feeling in your lower back?',
                    'text_zh'        => '腰部冷痛或酸痛？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale', 'swollen'],
                ],
                [
                    'id'             => 'sy22-q3',
                    'text_en'        => 'Do you need to urinate frequently at night?',
                    'text_zh'        => '夜间频繁起来小便？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['pale', 'wet'],
                ],
                [
                    'id'             => 'sy22-q4',
                    'text_en'        => 'How often do you feel low energy, especially in cold weather?',
                    'text_zh'        => '天气冷时特别没精神的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale'],
                ],
                [
                    'id'             => 'sy22-q5',
                    'text_en'        => 'Do you prefer warm drinks and dislike cold ones?',
                    'text_zh'        => '偏好温热饮，不喜冷饮？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['pale', 'wet'],
                ],
            ],
        ],

        // ═══════════════════════════════════════════════════════════
        // Heat (excess / fire) umbrella
        // ═══════════════════════════════════════════════════════════

        'SY08' => [
            'name_en'        => 'Liver Qi to Fire',
            'name_zh'        => '肝郁化火证',
            'umbrella'       => 'heat',
            'tongue_signs'   => ['red_sides', 'red', 'yellow_coat'],
            'source_chapter' => '中医证候鉴别诊断学 第138章 肝火上炎证',
            'questions' => [
                [
                    'id'             => 'sy08-q1',
                    'text_en'        => 'Have you been more irritable or quick to anger than usual?',
                    'text_zh'        => '比平时更易烦躁或发怒？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['red_sides'],
                ],
                [
                    'id'             => 'sy08-q2',
                    'text_en'        => 'Do you wake up with a bitter taste in your mouth?',
                    'text_zh'        => '早上起来口苦？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['yellow_coat', 'red_sides'],
                ],
                [
                    'id'             => 'sy08-q3',
                    'text_en'        => 'Do you have headaches, especially on the temples or top of the head?',
                    'text_zh'        => '头痛，尤其太阳穴或头顶部位？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['red_sides', 'red'],
                ],
                [
                    'id'             => 'sy08-q4',
                    'text_en'        => 'How often are your eyes red, dry, or do you feel pressure behind them?',
                    'text_zh'        => '眼睛红肿、干涩，或眼后胀压感的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['red_sides', 'red'],
                ],
                [
                    'id'             => 'sy08-q5',
                    'text_en'        => 'Are you constipated, or do your stools feel dry and hard?',
                    'text_zh'        => '便秘，或大便干硬？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['yellow_coat', 'red'],
                ],
            ],
        ],

        // ═══════════════════════════════════════════════════════════
        // Damp-heat umbrella
        // ═══════════════════════════════════════════════════════════

        'SY28' => [
            'name_en'        => 'Damp-Heat Middle Burner',
            'name_zh'        => '湿热中焦证',
            'umbrella'       => 'damp_heat',
            'tongue_signs'   => ['yellow_greasy_coat', 'red', 'thick_coat'],
            'source_chapter' => '中医证候鉴别诊断学 第295章 阳明湿热证',
            'questions' => [
                [
                    'id'             => 'sy28-q1',
                    'text_en'        => 'Do you have a heavy or sticky sensation in your stomach after eating?',
                    'text_zh'        => '饭后胃部沉重或黏腻感？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['yellow_greasy_coat', 'thick_coat'],
                ],
                [
                    'id'             => 'sy28-q2',
                    'text_en'        => 'Is your mouth sticky, with a sweet or bitter aftertaste?',
                    'text_zh'        => '口黏腻，带有甜味或苦味？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['yellow_greasy_coat'],
                ],
                [
                    'id'             => 'sy28-q3',
                    'text_en'        => 'Do you feel heavy and sluggish in your body, especially in humid weather?',
                    'text_zh'        => '身体沉重困倦，潮湿天气更明显？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['thick_coat', 'yellow_greasy_coat'],
                ],
                [
                    'id'             => 'sy28-q4',
                    'text_en'        => 'How often are your stools loose, foul-smelling, or feel incomplete?',
                    'text_zh'        => '大便稀、臭，或排不干净感的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['yellow_greasy_coat'],
                ],
                [
                    'id'             => 'sy28-q5',
                    'text_en'        => 'Is your urine dark yellow, with a strong smell?',
                    'text_zh'        => '小便深黄，气味重？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['yellow_greasy_coat', 'red'],
                ],
            ],
        ],

        // ═══════════════════════════════════════════════════════════
        // Blood Stasis umbrella (new SY31, added 2026-05-11)
        // ═══════════════════════════════════════════════════════════

        'SY31' => [
            'name_en'        => 'Blood Stasis',
            'name_zh'        => '血瘀证',
            'umbrella'       => 'stasis',
            'tongue_signs'   => ['purple', 'petechiae', 'dark', 'sublingual_veins'],
            'source_chapter' => '中医证候鉴别诊断学 第9章 血瘀证',
            'questions' => [
                [
                    'id'             => 'sy31-q1',
                    'text_en'        => 'Do you have a sharp, fixed-location pain (always at the same spot)?',
                    'text_zh'        => '有针刺样、位置固定的疼痛？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['purple', 'dark'],
                ],
                [
                    'id'             => 'sy31-q2',
                    'text_en'        => 'Do your lips or fingernails look bluish or dark purple?',
                    'text_zh'        => '嘴唇或指甲呈青紫色？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['purple', 'dark'],
                ],
                [
                    'id'             => 'sy31-q3',
                    'text_en'        => '(Women) Do you have menstrual blood clots, or dark/blackish period blood?',
                    'text_zh'        => '（女性）月经有血块，或经血颜色暗黑？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'high',
                    'signal_signs'   => ['purple', 'petechiae'],
                ],
                [
                    'id'             => 'sy31-q4',
                    'text_en'        => 'Do you bruise easily, or have visible spider/varicose veins?',
                    'text_zh'        => '容易瘀青，或有蜘蛛纹/静脉曲张？',
                    'response_type'  => 'yes_no_sometimes',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['petechiae', 'sublingual_veins'],
                ],
                [
                    'id'             => 'sy31-q5',
                    'text_en'        => 'How often does the pain get worse at night or when you press on it?',
                    'text_zh'        => '疼痛在夜间或按压时加重的频率？',
                    'response_type'  => 'scale_1_5',
                    'clinical_weight'=> 'medium',
                    'signal_signs'   => ['purple', 'dark'],
                ],
            ],
        ],
    ];

    /**
     * Returns the candidate syndrome IDs for an umbrella pattern.
     * Used by the wellness-assessment controller to know which
     * specific syndromes the AI selector should consider.
     */
    public static function syndromesFor(string $umbrellaPattern): array
    {
        return self::PATTERN_TO_SYNDROMES[$umbrellaPattern] ?? [];
    }

    /**
     * Returns the full question entry for a syndrome ID, or null if
     * the syndrome isn't in the bank (yet).
     */
    public static function forSyndrome(string $syndromeId): ?array
    {
        return self::QUESTIONS[$syndromeId] ?? null;
    }

    /**
     * Lightweight question selector for cases where we DON'T want to
     * call Claude to pick (e.g., fallback, low-confidence tongue
     * analysis). Returns the top-N highest-weighted questions, biased
     * toward those tagged with one of the supplied tongue signs.
     *
     * The full Claude-driven selector lives in the controller — this
     * is a deterministic backup.
     */
    public static function selectQuestionsFor(
        string $syndromeId,
        array $tongueSigns = [],
        int $count = 4
    ): array {
        $entry = self::forSyndrome($syndromeId);
        if (! $entry) return [];

        $scored = [];
        foreach ($entry['questions'] as $q) {
            $weight = match ($q['clinical_weight']) {
                'high'   => 3,
                'medium' => 2,
                'low'    => 1,
                default  => 1,
            };
            $signalBoost = count(array_intersect($q['signal_signs'] ?? [], $tongueSigns));
            $scored[] = ['q' => $q, 'score' => $weight + $signalBoost];
        }

        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
        return array_map(fn($s) => $s['q'], array_slice($scored, 0, $count));
    }
}
