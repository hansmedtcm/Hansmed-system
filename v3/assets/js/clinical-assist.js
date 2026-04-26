/**
 * HM.clinicalAssist — physician decision support for the consult page.
 *
 * Pure-frontend module. Takes the patient context (chief complaint
 * text, BP, pulse, age, optionally questionnaire dimensions) and
 * returns a structured "should I look out for…" payload the consult
 * UI surfaces alongside the case-record form. Every alert links back
 * to the rule that produced it so the doctor can audit the
 * recommendation.
 *
 * Source for clinical content:
 *   • The 5-Minute Clinical Consult 2017 (Domino FJ et al., Wolters
 *     Kluwer) — used as a curated reference for chief-complaint
 *     red flags, history-taking checklists, and differential
 *     diagnoses. Content is structured here in our own words; the
 *     book provides the clinical grounding (decision trees per
 *     complaint).
 *
 * NOT a diagnostic device. Output is suggestions for the doctor to
 * weigh — never a replacement for clinical judgement. Every output
 * carries the {source} attribution so the doctor can show the
 * patient where a recommendation came from.
 *
 * Entry point:
 *   HM.clinicalAssist.evaluate({
 *     chief_complaint: 'severe headache for 3 days',
 *     bp:              '180/110',
 *     pulse:           '88',
 *     age:             58,
 *     dimensions:      { qi_xu: -2, ti_re: -1, ... },  // optional
 *   }) → {
 *     red_flags:    [{ severity, msg_en, msg_zh, action_en, action_zh }],
 *     questions:    [{ q_en, q_zh, why }],
 *     differentials:[{ name_en, name_zh, note }],
 *     vitals_alerts:[{ severity, msg_en, msg_zh }],
 *     matched_complaints: ['headache'],
 *     source: 'The 5-Minute Clinical Consult 2017',
 *   }
 */
(function () {
  'use strict';
  window.HM = window.HM || {};

  // ── Generic vitals thresholds ─────────────────────────────────
  // Applied regardless of chief complaint. Per JNC 8 / 2017 ACC-AHA
  // hypertension guideline + standard adult vital ranges.
  function checkVitals(input) {
    var alerts = [];
    var bp = parseBp(input.bp);
    var hr = parseInt(input.pulse, 10);
    var age = input.age ? parseInt(input.age, 10) : null;

    if (bp) {
      if (bp.sys >= 180 || bp.dia >= 120) {
        alerts.push({
          severity: 'critical',
          msg_en: 'Hypertensive crisis (' + bp.sys + '/' + bp.dia + '). Refer to emergency room IMMEDIATELY if symptomatic (chest pain, headache, neuro deficits, vision changes, dyspnoea).',
          msg_zh: '高血壓危象（' + bp.sys + '/' + bp.dia + '）。如伴胸痛、頭痛、神經症狀、視覺變化、呼吸困難，立即轉急診。',
        });
      } else if (bp.sys >= 160 || bp.dia >= 100) {
        alerts.push({
          severity: 'high',
          msg_en: 'Stage 2 hypertension (' + bp.sys + '/' + bp.dia + '). Recommend GP referral within 1 week; consider antihypertensive in addition to TCM care.',
          msg_zh: '二期高血壓（' + bp.sys + '/' + bp.dia + '）。建議1週內西醫評估，可考慮配合降壓藥。',
        });
      } else if (bp.sys >= 140 || bp.dia >= 90) {
        alerts.push({
          severity: 'medium',
          msg_en: 'Stage 1 hypertension (' + bp.sys + '/' + bp.dia + '). Lifestyle + TCM management; recheck in 4 weeks.',
          msg_zh: '一期高血壓（' + bp.sys + '/' + bp.dia + '）。配合生活方式調整，4週後複查。',
        });
      } else if (bp.sys < 90 || bp.dia < 60) {
        alerts.push({
          severity: 'medium',
          msg_en: 'Hypotension (' + bp.sys + '/' + bp.dia + '). If symptomatic (dizzy/syncope on standing) → check for dehydration, GI bleed, sepsis, adrenal insufficiency, or medication side effects.',
          msg_zh: '血壓偏低（' + bp.sys + '/' + bp.dia + '）。如伴頭暈/暈厥，需排查脫水、消化道出血、感染、腎上腺功能不足或藥物影響。',
        });
      }
    }

    if (hr) {
      if (hr >= 130) {
        alerts.push({
          severity: 'high',
          msg_en: 'Marked tachycardia (HR ' + hr + '). Consider atrial fibrillation, hyperthyroidism, sepsis, dehydration, anxiety, anaemia, PE. ECG recommended.',
          msg_zh: '明顯心動過速（' + hr + '）。考慮心房顫動、甲亢、感染、脫水、焦慮、貧血、肺栓塞。建議心電圖。',
        });
      } else if (hr >= 100) {
        alerts.push({
          severity: 'medium',
          msg_en: 'Tachycardia (HR ' + hr + '). Rule out fever, dehydration, anaemia, anxiety, hyperthyroidism.',
          msg_zh: '心動過速（' + hr + '）。排查發熱、脫水、貧血、焦慮、甲亢。',
        });
      } else if (hr <= 40) {
        alerts.push({
          severity: 'high',
          msg_en: 'Severe bradycardia (HR ' + hr + '). Refer for ECG — consider AV block, sick sinus syndrome, hypothyroidism, or β-blocker overdose.',
          msg_zh: '嚴重心動過緩（' + hr + '）。建議心電圖檢查，排查房室阻滯、病態竇房結、甲狀腺功能低下或β受體阻滯劑過量。',
        });
      } else if (hr <= 50 && (! age || age < 60)) {
        alerts.push({
          severity: 'low',
          msg_en: 'Bradycardia (HR ' + hr + '). Often benign in athletic patients; otherwise consider hypothyroidism, sleep apnoea, medication.',
          msg_zh: '心動過緩（' + hr + '）。運動員常見；其他情況考慮甲狀腺功能低下、睡眠呼吸暫停、藥物影響。',
        });
      }
    }

    return alerts;
  }

  function parseBp(s) {
    if (!s) return null;
    var m = String(s).match(/^\s*(\d{2,3})\s*[\/\-]\s*(\d{2,3})/);
    if (!m) return null;
    return { sys: parseInt(m[1], 10), dia: parseInt(m[2], 10) };
  }

  // ── Chief-complaint catalogue ─────────────────────────────────
  //
  // Each entry:
  //   triggers:   regex of keywords (case-insensitive). When the
  //               complaint text matches, this entry activates.
  //   red_flags:  things that warrant urgent referral / immediate
  //               investigation. Drawn from 5-Minute Clinical
  //               Consult 2017 decision trees per complaint.
  //   questions:  history-taking checklist (what to ask).
  //   differentials: conditions to consider before assuming the
  //               obvious. Each carries a one-line "what makes you
  //               think of this" hint.
  //
  // Coverage is curated for what walks into a Malaysian TCM clinic,
  // not exhaustive. Unmatched complaints still get vitals + age
  // checks via evaluate() below.
  var COMPLAINTS = {

    // ── Headache ─────────────────────────────────────────────
    headache: {
      label_en: 'Headache', label_zh: '頭痛',
      triggers: /head\s*ache|migrai|頭痛|偏頭痛|head pain/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Sudden "thunderclap" headache (worst headache of life) — refer to ER for SAH (subarachnoid haemorrhage) workup.', msg_zh: '突發「雷擊樣」頭痛（一生中最劇烈）— 立即轉急診排除蛛網膜下腔出血。' },
        { severity: 'critical', msg_en: 'Headache + fever + neck stiffness + photophobia — consider meningitis, refer to ER.', msg_zh: '頭痛 + 發熱 + 頸項強直 + 畏光 — 考慮腦膜炎，轉急診。' },
        { severity: 'high',     msg_en: 'New headache after age 50 — investigate for giant-cell arteritis (ESR), tumour, or stroke.', msg_zh: '50歲後新發頭痛 — 排查巨細胞動脈炎（ESR）、腫瘤、卒中。' },
        { severity: 'high',     msg_en: 'Progressive headache over weeks, worse in morning, with nausea/vomiting — refer for neuroimaging (rule out mass).', msg_zh: '數週內漸進加重，晨起更甚伴嘔吐 — 影像學排除顱內佔位。' },
        { severity: 'high',     msg_en: 'Headache with focal neurologic deficit (weakness, numbness, vision/speech change) — refer for stroke workup.', msg_zh: '伴局灶性神經缺損（無力、麻木、視覺/語言改變）— 轉診排除卒中。' },
        { severity: 'high',     msg_en: 'Headache with papilloedema or visual loss — possible idiopathic intracranial hypertension; ophthalmology + neurology referral.', msg_zh: '伴視乳頭水腫或視力下降 — 可能為特發性顱內高壓，眼科+神經科會診。' },
        { severity: 'medium',   msg_en: 'New headache pattern in pregnancy — rule out pre-eclampsia (check BP + protein in urine).', msg_zh: '孕期新發頭痛 — 排查妊娠高血壓（測血壓+尿蛋白）。' },
      ],
      questions: [
        { q_en: 'Onset: sudden vs gradual? "Worst ever"?',                   q_zh: '發病：突然或漸進？「最劇烈」？',                  why: 'Thunderclap = SAH risk' },
        { q_en: 'Location: unilateral vs bilateral, throbbing vs steady?',  q_zh: '部位：單側雙側？跳痛或持續？',                    why: 'Migraine vs tension-type' },
        { q_en: 'Triggers: stress, food, light, neck position, period?',    q_zh: '誘因：壓力、食物、光線、頸位、月經？',            why: 'Migraine triggers' },
        { q_en: 'Associated: nausea, vomiting, photo/phonophobia, aura?',   q_zh: '伴隨：噁心嘔吐、畏光畏聲、先兆？',                why: 'Migraine criteria' },
        { q_en: 'Fever, neck stiffness, rash?',                              q_zh: '發熱、頸項強直、皮疹？',                          why: 'Meningitis screen' },
        { q_en: 'Vision changes, weakness, numbness, speech difficulty?',    q_zh: '視覺變化、無力、麻木、說話困難？',                why: 'Stroke / TIA / mass' },
        { q_en: 'Recent head trauma?',                                       q_zh: '近期頭部外傷？',                                 why: 'Subdural haematoma' },
        { q_en: 'Medications (analgesic overuse), caffeine intake?',         q_zh: '用藥（止痛藥過用）、咖啡因？',                    why: 'Medication overuse headache' },
        { q_en: 'Sleep, stress, eye strain pattern?',                        q_zh: '睡眠、壓力、用眼模式？',                          why: 'Tension-type headache' },
      ],
      differentials: [
        { name_en: 'Tension-type headache',     name_zh: '緊張型頭痛',       note: 'Bilateral, band-like, no nausea — most common' },
        { name_en: 'Migraine',                  name_zh: '偏頭痛',           note: 'Unilateral throbbing + nausea/photophobia' },
        { name_en: 'Cluster headache',          name_zh: '叢集性頭痛',       note: 'Severe periorbital + lacrimation/nasal symptoms' },
        { name_en: 'Cervicogenic headache',     name_zh: '頸源性頭痛',       note: 'Originates from neck; relieved by neck mobilisation' },
        { name_en: 'Sinusitis',                 name_zh: '鼻竇炎',           note: 'Frontal/maxillary, worse on bending forward, nasal congestion' },
        { name_en: 'Hypertensive headache',     name_zh: '高血壓性頭痛',     note: 'BP usually >180/110' },
        { name_en: 'Medication overuse headache', name_zh: '藥物過用性頭痛', note: 'Daily analgesic use → rebound' },
        { name_en: 'SAH / mass / GCA / stroke', name_zh: '蛛網膜下腔出血/佔位/巨細胞動脈炎/卒中', note: 'Red-flag presentations — refer' },
      ],
    },

    // ── Dizziness ────────────────────────────────────────────
    dizziness: {
      label_en: 'Dizziness', label_zh: '眩暈',
      triggers: /dizzi|vertigo|lightheaded|頭暈|眩暈|站不穩/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Dizziness + slurred speech / facial droop / one-sided weakness — refer to ER for stroke workup (FAST).', msg_zh: '眩暈 + 言語含糊/面癱/單側無力 — 立即轉急診排除卒中（FAST）。' },
        { severity: 'high',     msg_en: 'Vertigo + new hearing loss + severe persistent imbalance — consider posterior-circulation stroke or acoustic neuroma.', msg_zh: '眩暈 + 新發聽力下降 + 持續嚴重失衡 — 考慮後循環卒中或聽神經瘤。' },
        { severity: 'high',     msg_en: 'Syncope (loss of consciousness) — investigate cardiac cause (arrhythmia, aortic stenosis); ECG mandatory.', msg_zh: '暈厥（意識喪失）— 排查心源性（心律失常、主動脈瓣狹窄），必做心電圖。' },
        { severity: 'medium',   msg_en: 'Orthostatic hypotension drop > 20 mmHg systolic — consider dehydration, GI bleed, autonomic neuropathy, polypharmacy.', msg_zh: '體位性低血壓（收縮壓降 >20 mmHg）— 考慮脫水、消化道出血、自主神經病變、多重用藥。' },
      ],
      questions: [
        { q_en: 'True spinning vertigo, vs faint/lightheaded, vs imbalance?', q_zh: '真正旋轉感？將暈感？失衡？',          why: 'Dizziness has 4 distinct buckets' },
        { q_en: 'Triggered by head position changes (BPPV)?',                 q_zh: '頭位改變誘發？（BPPV）',              why: 'BPPV = positional vertigo' },
        { q_en: 'Hearing loss, tinnitus, ear fullness?',                      q_zh: '聽力下降、耳鳴、耳脹？',              why: 'Meniere\'s, acoustic neuroma' },
        { q_en: 'Duration: seconds, minutes, hours, days?',                   q_zh: '持續時間：秒/分/時/天？',              why: 'Differentiates BPPV vs vestibular neuritis vs central' },
        { q_en: 'Recent URI?',                                                q_zh: '近期上呼吸道感染？',                  why: 'Vestibular neuritis follows viral URI' },
        { q_en: 'New medications (antihypertensives, sedatives)?',            q_zh: '新用藥（降壓藥、鎮靜劑）？',         why: 'Common medication side effect' },
        { q_en: 'Check orthostatic BP (lying → standing)',                     q_zh: '測立臥位血壓變化',                    why: 'Orthostatic hypotension' },
      ],
      differentials: [
        { name_en: 'BPPV (benign positional vertigo)',  name_zh: '良性陣發性位置性眩暈', note: 'Brief vertigo on head position change; Dix-Hallpike confirms' },
        { name_en: 'Vestibular neuritis',                name_zh: '前庭神經炎',           note: 'Continuous vertigo days, after viral URI' },
        { name_en: 'Meniere\'s disease',                 name_zh: '梅尼埃病',             note: 'Vertigo + tinnitus + fluctuating hearing loss' },
        { name_en: 'Orthostatic hypotension',            name_zh: '體位性低血壓',         note: 'On standing; check BP changes' },
        { name_en: 'Anaemia',                            name_zh: '貧血',                 note: 'Lightheadedness + pallor + fatigue' },
        { name_en: 'Anxiety / hyperventilation',         name_zh: '焦慮/換氣過度',       note: 'Reproducible by hyperventilating' },
        { name_en: 'Cerebellar / brainstem stroke',      name_zh: '小腦/腦幹卒中',       note: 'Sudden, with neuro deficits — REFER' },
      ],
    },

    // ── Chest pain ───────────────────────────────────────────
    chest_pain: {
      label_en: 'Chest pain', label_zh: '胸痛',
      triggers: /chest\s*pain|胸痛|胸悶/i,
      red_flags: [
        { severity: 'critical', msg_en: '⚠️ ANY chest pain in a TCM clinic should be triaged urgently. Refer to ER if: pressure/squeezing >10 min, radiation to arm/jaw/back, dyspnoea, diaphoresis, nausea, or syncope. ECG + troponin needed STAT.', msg_zh: '⚠️ 中醫診所遇胸痛須緊急分流。若壓榨感>10分鐘、放射至臂/下顎/背、伴呼吸困難、冷汗、噁心或暈厥 — 立即轉急診（需心電圖+肌鈣蛋白）。' },
        { severity: 'critical', msg_en: 'Tearing chest pain radiating to back + BP differential between arms — consider aortic dissection, ER immediately.', msg_zh: '撕裂樣胸痛放射至背 + 兩臂血壓差 — 考慮主動脈夾層，立即急診。' },
        { severity: 'critical', msg_en: 'Sudden pleuritic chest pain + dyspnoea + tachycardia (esp. post-flight, post-surgery, immobilised) — refer for PE workup.', msg_zh: '突發胸膜炎性胸痛 + 呼吸困難 + 心動過速（尤其長途飛行/術後/久臥後）— 轉診排除肺栓塞。' },
      ],
      questions: [
        { q_en: 'Quality: pressure / squeezing / sharp / tearing / burning?',  q_zh: '性質：壓榨、銳痛、撕裂樣、燒灼？',         why: 'Cardiac vs other' },
        { q_en: 'Radiation: arm, jaw, back, shoulder?',                       q_zh: '放射：臂、下顎、背、肩？',                  why: 'Classic ACS pattern' },
        { q_en: 'Triggers: exertion, meals, breathing, position change?',     q_zh: '誘因：運動、進食、呼吸、體位？',             why: 'Angina vs GERD vs pleuritic' },
        { q_en: 'Duration and pattern?',                                       q_zh: '持續時間與發作規律？',                       why: 'Stable vs unstable angina' },
        { q_en: 'Associated: dyspnoea, diaphoresis, nausea, palpitations?',    q_zh: '伴隨：呼吸困難、冷汗、噁心、心悸？',         why: 'Cardiac high suspicion' },
        { q_en: 'Cardiac risk factors: HTN, DM, smoking, family hx, age?',     q_zh: '心血管風險因素：高血壓、糖尿病、吸菸、家族史、年齡？', why: 'Risk stratification' },
      ],
      differentials: [
        { name_en: 'Acute coronary syndrome (STEMI / NSTEMI / unstable angina)', name_zh: '急性冠脈綜合徵', note: '⚠️ MUST RULE OUT — refer immediately for ECG + troponin' },
        { name_en: 'Aortic dissection',         name_zh: '主動脈夾層',     note: 'Tearing, BP differential — ER' },
        { name_en: 'Pulmonary embolism',         name_zh: '肺栓塞',         note: 'Pleuritic + dyspnoea + tachycardia — ER' },
        { name_en: 'GERD',                       name_zh: '胃食道反流',     note: 'Burning, post-meal, supine worse, antacid relief' },
        { name_en: 'Costochondritis',            name_zh: '肋軟骨炎',       note: 'Reproducible by chest-wall palpation' },
        { name_en: 'Anxiety / panic',            name_zh: '焦慮/恐慌',     note: 'Diagnosis of EXCLUSION — rule out cardiac first' },
        { name_en: 'Pneumothorax',               name_zh: '氣胸',           note: 'Sudden, sharp, dyspnoea — ER' },
      ],
    },

    // ── Abdominal pain ──────────────────────────────────────
    abdominal_pain: {
      label_en: 'Abdominal pain', label_zh: '腹痛',
      triggers: /abdom|stomach\s*ach|belly|腹痛|肚子痛|胃痛/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Rigid abdomen, rebound tenderness, severe localised pain — surgical abdomen (perforation, appendicitis, ischaemia). REFER ER.', msg_zh: '腹肌強直、反跳痛、劇烈定位痛 — 急腹症（穿孔、闌尾炎、缺血）。立即急診。' },
        { severity: 'critical', msg_en: 'Severe pain + hypotension or syncope — consider ruptured ectopic pregnancy, AAA rupture, mesenteric ischaemia. ER.', msg_zh: '劇痛 + 低血壓或暈厥 — 考慮異位妊娠破裂、腹主動脈瘤破裂、腸繫膜缺血。急診。' },
        { severity: 'high',     msg_en: 'Vomiting blood / coffee-ground vomitus / black tarry stool — upper GI bleed; refer.', msg_zh: '嘔血/咖啡渣樣嘔吐物/黑便 — 上消化道出血，轉診。' },
        { severity: 'high',     msg_en: 'Right-upper-quadrant pain + fever + jaundice (Charcot triad) — cholangitis. Refer.', msg_zh: '右上腹痛 + 發熱 + 黃疸（Charcot 三聯徵）— 膽管炎。轉診。' },
        { severity: 'high',     msg_en: 'Pregnant woman with abdominal pain — consider ectopic, abruptio placentae. Refer urgently.', msg_zh: '孕婦腹痛 — 考慮異位妊娠、胎盤早剝。緊急轉診。' },
        { severity: 'medium',   msg_en: 'Age >55 + new dyspepsia / anorexia / weight loss — refer for endoscopy (rule out gastric cancer, esp. SE Asia).', msg_zh: '55歲以上新發消化不良/食慾減退/體重下降 — 內鏡檢查排除胃癌（東南亞發病率高）。' },
      ],
      questions: [
        { q_en: 'Location: where does it hurt? (point with one finger)',     q_zh: '部位：哪裡痛？（用一指指）',         why: 'Localises differential' },
        { q_en: 'Onset: sudden vs gradual? Constant vs colicky?',            q_zh: '起病：突發或漸進？持續或絞痛？',     why: 'Surgical vs medical' },
        { q_en: 'Relation to meals: better, worse, or same?',                q_zh: '與進食關係：好轉、加重、無關？',     why: 'Peptic ulcer / cholelithiasis / IBS' },
        { q_en: 'Bowel habits: diarrhoea, constipation, blood, melena?',     q_zh: '排便：腹瀉、便秘、便血、黑便？',     why: 'IBD, colorectal Ca, bleed' },
        { q_en: 'Fever, vomiting, jaundice?',                                 q_zh: '發熱、嘔吐、黃疸？',                  why: 'Infection, biliary' },
        { q_en: 'Menstrual hx + LMP for women of reproductive age',           q_zh: '育齡女性月經史 + 末次月經',          why: 'Ectopic, PID, ovarian' },
        { q_en: 'Weight loss, night sweats, family hx GI cancer?',            q_zh: '體重下降、盜汗、消化道腫瘤家族史？', why: 'Malignancy screen' },
        { q_en: 'NSAID use, alcohol, smoking?',                                q_zh: '非甾體止痛藥、酒、菸？',              why: 'Peptic ulcer risk' },
      ],
      differentials: [
        { name_en: 'Functional dyspepsia',      name_zh: '功能性消化不良',   note: '>70% of dyspepsia; diagnosis of exclusion' },
        { name_en: 'Peptic ulcer',              name_zh: '消化性潰瘍',       note: 'Burning, related to meals; H. pylori, NSAIDs' },
        { name_en: 'GERD',                      name_zh: '胃食道反流',       note: 'Burning + regurgitation' },
        { name_en: 'Cholelithiasis / cholecystitis', name_zh: '膽結石/膽囊炎', note: 'RUQ, fatty meals trigger' },
        { name_en: 'Appendicitis',              name_zh: '闌尾炎',           note: 'Periumbilical → RLQ, fever, anorexia' },
        { name_en: 'Pancreatitis',              name_zh: '胰腺炎',           note: 'Epigastric → back, alcohol/gallstones' },
        { name_en: 'IBS',                       name_zh: '腸躁症',           note: 'Chronic, alters with bowel habit, no red flags' },
        { name_en: 'Gastric / colorectal cancer', name_zh: '胃癌/結直腸癌',  note: 'Age >50, weight loss, anaemia, bleed — REFER' },
      ],
    },

    // ── Low back pain ────────────────────────────────────────
    low_back_pain: {
      label_en: 'Low back pain', label_zh: '腰痛',
      triggers: /back\s*pain|lumbago|lower\s*back|腰痛|腰背痛/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Saddle anaesthesia + bowel/bladder incontinence or acute urinary retention — cauda equina syndrome, REFER ER for emergency MRI + neurosurgery.', msg_zh: '會陰部麻木 + 大小便失禁/急性尿瀦留 — 馬尾綜合徵，立即急診MRI+神經外科。' },
        { severity: 'high',     msg_en: 'Bilateral sciatica + progressive neurologic symptoms — possible cauda equina, urgent imaging.', msg_zh: '雙側坐骨神經痛 + 漸進性神經症狀 — 可能馬尾，緊急影像。' },
        { severity: 'high',     msg_en: 'History of malignancy + new back pain — investigate for metastasis (MRI).', msg_zh: '腫瘤病史 + 新發腰痛 — 排除骨轉移（MRI）。' },
        { severity: 'high',     msg_en: 'Pain worse when supine / at night + weight loss — possible malignancy or infection.', msg_zh: '臥位/夜間更甚 + 體重下降 — 可能腫瘤或感染。' },
        { severity: 'high',     msg_en: 'Fever + back pain + IV drug use — vertebral osteomyelitis / epidural abscess. Refer.', msg_zh: '發熱 + 腰痛 + 靜脈毒品史 — 脊椎骨髓炎/硬膜外膿腫。轉診。' },
        { severity: 'medium',   msg_en: 'Age >50 with new back pain → AAA possible (especially with abdominal pulsatile mass).', msg_zh: '50歲以上新發腰痛 — 排查腹主動脈瘤（尤其腹部搏動性包塊）。' },
      ],
      questions: [
        { q_en: 'Mechanism: trauma, lifting, gradual onset?',               q_zh: '機制：外傷、用力、漸進？',           why: 'Mechanical vs pathological' },
        { q_en: 'Radiation down the leg? Below the knee?',                  q_zh: '放射至腿？膝以下？',                  why: 'Radiculopathy / sciatica' },
        { q_en: 'Numbness, weakness, change in reflexes?',                  q_zh: '麻木、無力、反射改變？',              why: 'Nerve root involvement' },
        { q_en: 'Bowel / bladder changes? Saddle area numbness?',            q_zh: '大小便變化？會陰部麻木？',            why: 'CAUDA EQUINA — emergency' },
        { q_en: 'Worse at night or rest? Better with movement?',             q_zh: '夜間/休息更甚？活動好轉？',          why: 'Inflammatory (AS) vs mechanical' },
        { q_en: 'Fever, weight loss, history of cancer?',                    q_zh: '發熱、體重下降、腫瘤病史？',          why: 'Red flags' },
      ],
      differentials: [
        { name_en: 'Mechanical / muscular strain', name_zh: '肌肉勞損',     note: 'Most common; resolves with conservative care' },
        { name_en: 'Lumbar disc herniation',       name_zh: '腰椎間盤突出', note: 'Radiating pain, positive SLR' },
        { name_en: 'Spinal stenosis',              name_zh: '椎管狹窄',     note: 'Older patient, pseudoclaudication, better leaning forward' },
        { name_en: 'Sacroiliac joint dysfunction', name_zh: '骶髂關節紊亂', note: 'Localised, worse on stairs' },
        { name_en: 'Ankylosing spondylitis',       name_zh: '強直性脊柱炎', note: 'Young male, morning stiffness >1hr, better with movement' },
        { name_en: 'Osteoporotic compression fracture', name_zh: '骨質疏鬆性壓縮骨折', note: 'Older, sudden onset after minor force' },
        { name_en: 'Pyelonephritis',               name_zh: '腎盂腎炎',     note: 'Flank pain + fever + dysuria' },
        { name_en: 'AAA / cauda equina / metastasis', name_zh: '腹主動脈瘤/馬尾/轉移', note: 'Red-flag presentations — REFER' },
      ],
    },

    // ── Cough ────────────────────────────────────────────────
    cough: {
      label_en: 'Cough', label_zh: '咳嗽',
      triggers: /cough|咳嗽|咳痰/i,
      red_flags: [
        { severity: 'high', msg_en: 'Haemoptysis (coughing blood) — refer for chest X-ray + investigate TB, lung cancer, PE, bronchiectasis.', msg_zh: '咳血 — 胸片排查肺結核、肺癌、肺栓塞、支氣管擴張。' },
        { severity: 'high', msg_en: 'Cough >3 weeks + weight loss + night sweats — TB workup (especially in SE Asia).', msg_zh: '咳嗽>3週 + 體重下降 + 盜汗 — 排查肺結核（東南亞高發）。' },
        { severity: 'high', msg_en: 'Cough + dyspnoea + leg swelling — consider CHF, PE.', msg_zh: '咳嗽 + 呼吸困難 + 下肢水腫 — 考慮心衰、肺栓塞。' },
        { severity: 'medium', msg_en: 'Smoker >40 with new chronic cough — chest X-ray; consider lung cancer.', msg_zh: '40歲以上吸菸者新發慢性咳嗽 — 胸片排查肺癌。' },
      ],
      questions: [
        { q_en: 'Duration: <3 weeks (acute), 3–8 weeks (subacute), >8 weeks (chronic)?', q_zh: '時長：急性<3週、亞急性3-8週、慢性>8週？', why: 'Categorisation' },
        { q_en: 'Productive of sputum? Colour? Blood?',                       q_zh: '有痰？顏色？帶血？',                why: 'Bacterial vs viral, malignancy' },
        { q_en: 'Fever, dyspnoea, chest pain, wheeze?',                        q_zh: '發熱、呼吸困難、胸痛、喘鳴？',     why: 'Pneumonia, asthma, PE' },
        { q_en: 'Worse at night / lying down (think postnasal drip, GERD)?',  q_zh: '夜間/平臥更甚？（鼻後滴漏、反流）',  why: 'Common chronic cough causes' },
        { q_en: 'TB exposure? Travel? Sick contacts?',                         q_zh: '結核接觸？旅行？病人接觸？',         why: 'Infectious risk' },
        { q_en: 'ACE inhibitor use?',                                          q_zh: '使用ACE抑制劑？',                    why: 'Drug-induced cough' },
        { q_en: 'Smoking history?',                                             q_zh: '吸菸史？',                          why: 'COPD, lung Ca' },
      ],
      differentials: [
        { name_en: 'Viral URI / acute bronchitis', name_zh: '病毒性上呼吸道感染', note: 'Most common acute' },
        { name_en: 'Postnasal drip',               name_zh: '鼻後滴漏',         note: '#1 chronic cough cause' },
        { name_en: 'Asthma',                       name_zh: '哮喘',             note: 'Wheeze, nocturnal, exercise-induced' },
        { name_en: 'GERD',                         name_zh: '胃食道反流',       note: 'Cough worse supine / post-meal' },
        { name_en: 'ACE inhibitor cough',          name_zh: 'ACE抑制劑性咳嗽', note: 'Stop ACEI — resolves in days-weeks' },
        { name_en: 'Pneumonia',                    name_zh: '肺炎',             note: 'Fever + productive + crackles' },
        { name_en: 'TB',                           name_zh: '肺結核',           note: '>3 weeks + B-symptoms — high SE Asia prevalence' },
        { name_en: 'Lung cancer',                  name_zh: '肺癌',             note: 'Smoker, chronic, haemoptysis, weight loss' },
      ],
    },

    // ── Insomnia ─────────────────────────────────────────────
    insomnia: {
      label_en: 'Insomnia', label_zh: '失眠',
      triggers: /insomni|sleep|失眠|入睡困難|易醒/i,
      red_flags: [
        { severity: 'high',   msg_en: 'Suicidal ideation / hopelessness — refer to mental health urgently.', msg_zh: '自殺意念/絕望感 — 緊急轉介心理健康。' },
        { severity: 'medium', msg_en: 'Loud snoring + witnessed apnoea + daytime sleepiness (Epworth >10) — refer for sleep study (OSA).', msg_zh: '響鼾 + 目擊呼吸暫停 + 日間嗜睡（Epworth>10）— 轉診睡眠監測（OSA）。' },
        { severity: 'medium', msg_en: 'Restless legs / periodic limb movements — consider RLS workup (ferritin <50, dopaminergic).', msg_zh: '不寧腿/周期性肢體運動 — 排查不寧腿綜合徵（鐵蛋白<50、多巴胺治療）。' },
      ],
      questions: [
        { q_en: 'Sleep onset, maintenance, or early awakening?',              q_zh: '入睡困難、維持困難、早醒？',           why: 'Pattern hints aetiology' },
        { q_en: 'Sleep hygiene: caffeine, screens, schedule, alcohol?',       q_zh: '睡眠衛生：咖啡因、螢幕、規律、酒？',  why: 'Often the fix' },
        { q_en: 'Snoring or witnessed apnoea?',                                q_zh: '打鼾或呼吸暫停？',                    why: 'OSA screen' },
        { q_en: 'Mood: depression, anxiety, recent stressors?',                q_zh: '情緒：抑鬱、焦慮、近期壓力？',         why: 'Common cause' },
        { q_en: 'Pain, urinary frequency, restless legs?',                     q_zh: '疼痛、夜尿、不寧腿？',                why: 'Secondary insomnia' },
        { q_en: 'Medications, supplements, recreational drug use?',            q_zh: '用藥、補充劑、毒品？',                why: 'Drug-induced' },
      ],
      differentials: [
        { name_en: 'Primary insomnia',                name_zh: '原發性失眠',     note: 'Diagnosis of exclusion' },
        { name_en: 'Anxiety / depression',            name_zh: '焦慮/抑鬱',     note: 'Most common secondary cause' },
        { name_en: 'Obstructive sleep apnoea',        name_zh: '阻塞性睡眠呼吸暫停', note: 'Refer sleep study' },
        { name_en: 'Restless legs syndrome',          name_zh: '不寧腿綜合徵',   note: 'Check ferritin' },
        { name_en: 'Hyperthyroidism',                 name_zh: '甲亢',           note: 'Check TSH if other features' },
        { name_en: 'Caffeine / alcohol / stimulants', name_zh: '咖啡因/酒/興奮劑', note: 'Lifestyle audit first' },
        { name_en: 'Chronic pain',                    name_zh: '慢性疼痛',       note: 'Treat underlying' },
      ],
    },

    // ── Constipation ─────────────────────────────────────────
    constipation: {
      label_en: 'Constipation', label_zh: '便秘',
      triggers: /constipat|便秘|大便乾|排便困難/i,
      red_flags: [
        { severity: 'high',   msg_en: 'New constipation in age >50, change in stool calibre, or rectal bleeding — colorectal cancer screen (colonoscopy).', msg_zh: '50歲以上新發便秘、糞便變細、便血 — 結腸鏡排查結直腸癌。' },
        { severity: 'high',   msg_en: 'Constipation + weight loss + anaemia — refer for GI workup.', msg_zh: '便秘 + 體重下降 + 貧血 — 消化道評估。' },
        { severity: 'medium', msg_en: 'Severe constipation + abdominal distension + vomiting — rule out bowel obstruction (refer).', msg_zh: '嚴重便秘 + 腹脹 + 嘔吐 — 排除腸梗阻（轉診）。' },
      ],
      questions: [
        { q_en: 'Frequency: stools per week? Change from baseline?',          q_zh: '頻率：每週幾次？是否改變？',           why: 'Define change' },
        { q_en: 'Stool form: hard pellets, lumpy?',                            q_zh: '糞便形狀：硬球、塊狀？',              why: 'Bristol scale' },
        { q_en: 'Straining, incomplete evacuation, manual disimpaction?',      q_zh: '費力、排不淨、需手助？',              why: 'Pelvic floor / outlet' },
        { q_en: 'Blood, mucus, change in calibre?',                            q_zh: '便血、黏液、糞便變細？',              why: 'Cancer screen' },
        { q_en: 'Diet: fibre and water intake?',                                q_zh: '飲食：纖維與飲水？',                  why: 'Most common cause' },
        { q_en: 'Medications: opioids, anticholinergics, iron, calcium?',      q_zh: '用藥：阿片、抗膽鹼、鐵、鈣？',         why: 'Drug-induced' },
        { q_en: 'Family hx colorectal cancer?',                                q_zh: '結直腸癌家族史？',                    why: 'Risk stratification' },
      ],
      differentials: [
        { name_en: 'Functional constipation',     name_zh: '功能性便秘',   note: 'Most common' },
        { name_en: 'IBS-C',                       name_zh: '便秘型腸躁症', note: 'With abdominal pain that improves with defecation' },
        { name_en: 'Hypothyroidism',              name_zh: '甲狀腺功能低下', note: 'Check TSH if other features' },
        { name_en: 'Drug-induced',                name_zh: '藥物性',       note: 'Opioids, anticholinergics, iron' },
        { name_en: 'Colorectal cancer',           name_zh: '結直腸癌',     note: 'Age >50, change, bleed — colonoscopy' },
        { name_en: 'Pelvic-floor dysfunction',    name_zh: '盆底功能障礙', note: 'Anorectal manometry/biofeedback' },
        { name_en: 'Bowel obstruction',           name_zh: '腸梗阻',       note: 'Acute + distension + vomiting — REFER' },
      ],
    },

    // ── Acute diarrhoea ──────────────────────────────────────
    diarrhoea: {
      label_en: 'Diarrhoea', label_zh: '腹瀉',
      triggers: /diarrh|loose\s*stool|腹瀉|拉肚子/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Severe dehydration (orthostatic, dry mucosae, low urine output, confusion) — IV fluids, refer.', msg_zh: '嚴重脫水（體位性、口乾、尿少、神志改變）— 補液，轉診。' },
        { severity: 'high',     msg_en: 'Bloody diarrhoea + fever — bacterial dysentery, refer for stool studies.', msg_zh: '血便 + 發熱 — 細菌性痢疾，轉診大便培養。' },
        { severity: 'high',     msg_en: 'Recent antibiotic use + watery diarrhoea — consider C. difficile, refer.', msg_zh: '近期抗生素 + 水樣腹瀉 — 考慮艱難梭菌，轉診。' },
        { severity: 'medium',   msg_en: 'Diarrhoea >2 weeks (chronic) — investigate IBD, malabsorption, parasitic.', msg_zh: '腹瀉>2週（慢性）— 排查炎症性腸病、吸收不良、寄生蟲。' },
      ],
      questions: [
        { q_en: 'Duration: <14 days (acute) vs longer?',                       q_zh: '時長：<14天（急性）或更長？',         why: 'Acute vs chronic' },
        { q_en: 'Frequency, blood, mucus?',                                     q_zh: '頻率、便血、黏液？',                   why: 'Inflammatory vs non' },
        { q_en: 'Recent food, travel, sick contacts?',                          q_zh: '近期食物、旅行、接觸患者？',           why: 'Source identification' },
        { q_en: 'Recent antibiotics?',                                          q_zh: '近期抗生素？',                         why: 'C. diff' },
        { q_en: 'Hydration: fluid intake, urine output, dizziness?',            q_zh: '補水：飲水、尿量、頭暈？',             why: 'Dehydration screen' },
        { q_en: 'Fever, abdominal pain, weight loss?',                          q_zh: '發熱、腹痛、體重下降？',               why: 'Severity / chronic differentials' },
      ],
      differentials: [
        { name_en: 'Viral gastroenteritis',       name_zh: '病毒性胃腸炎', note: 'Most common acute' },
        { name_en: 'Bacterial (Salmonella, Shigella, Campylobacter)', name_zh: '細菌性', note: 'Bloody, fever, refer stool culture' },
        { name_en: 'Food poisoning',              name_zh: '食物中毒',     note: 'Acute, multiple people affected' },
        { name_en: 'C. difficile',                name_zh: '艱難梭菌',     note: 'Post-antibiotic — refer' },
        { name_en: 'IBD (Crohn\'s, UC)',           name_zh: '炎症性腸病',   note: 'Chronic + bleed + weight loss' },
        { name_en: 'IBS-D',                       name_zh: '腹瀉型腸躁症', note: 'Chronic, with pain, no red flags' },
        { name_en: 'Lactose intolerance / coeliac', name_zh: '乳糖不耐/麸質敏感', note: 'Diet-related; trial elimination' },
      ],
    },

    // ── Fatigue ──────────────────────────────────────────────
    fatigue: {
      label_en: 'Fatigue', label_zh: '疲勞',
      triggers: /fatigu|tired|exhaust|乏力|疲勞|疲倦|沒力/i,
      red_flags: [
        { severity: 'high',   msg_en: 'Fatigue + unintentional weight loss + night sweats — investigate malignancy, TB, HIV.', msg_zh: '疲勞 + 不明原因體重下降 + 盜汗 — 排查腫瘤、結核、HIV。' },
        { severity: 'high',   msg_en: 'Fatigue + dyspnoea + chest pain on exertion — cardiac workup (CHF, anaemia, ACS).', msg_zh: '疲勞 + 活動後呼吸困難/胸痛 — 心臟評估（心衰、貧血、冠心病）。' },
        { severity: 'medium', msg_en: 'Severe new-onset fatigue >1 month — basic workup: CBC, TSH, glucose, BUN/Cr, LFT, vit D, B12, ferritin.', msg_zh: '突發嚴重疲勞>1月 — 基礎檢查：血常規、TSH、血糖、腎功能、肝功能、維D、B12、鐵蛋白。' },
      ],
      questions: [
        { q_en: 'Duration: weeks vs months?',                                   q_zh: '時長：週或月？',                       why: 'Acute vs chronic' },
        { q_en: 'Sleep quality + quantity?',                                    q_zh: '睡眠品質與時長？',                    why: 'Common cause' },
        { q_en: 'Mood: depression, anxiety, anhedonia?',                        q_zh: '情緒：抑鬱、焦慮、失樂感？',           why: '#1 cause' },
        { q_en: 'Diet, exercise, weight change?',                                q_zh: '飲食、運動、體重變化？',              why: 'Lifestyle audit' },
        { q_en: 'Menstrual / GI bleeding (anaemia)?',                            q_zh: '月經/消化道出血（貧血）？',            why: 'IDA' },
        { q_en: 'Cold intolerance, hair loss, constipation (hypothyroid)?',     q_zh: '怕冷、脫髮、便秘（甲低）？',          why: 'Thyroid screen' },
        { q_en: 'Polyuria, polydipsia, weight loss (DM)?',                       q_zh: '多尿、多飲、體重下降（糖尿病）？',     why: 'DM screen' },
        { q_en: 'Snoring, daytime sleepiness (OSA)?',                            q_zh: '打鼾、日間嗜睡（OSA）？',             why: 'OSA screen' },
      ],
      differentials: [
        { name_en: 'Depression / anxiety',         name_zh: '抑鬱/焦慮',       note: 'Single most common cause' },
        { name_en: 'Sleep deprivation / OSA',      name_zh: '睡眠不足/OSA',    note: 'Treat sleep' },
        { name_en: 'Anaemia (iron-deficient)',     name_zh: '缺鐵性貧血',      note: 'Check CBC, ferritin' },
        { name_en: 'Hypothyroidism',               name_zh: '甲狀腺功能低下', note: 'TSH' },
        { name_en: 'Diabetes mellitus',            name_zh: '糖尿病',         note: 'Fasting glucose / HbA1c' },
        { name_en: 'Vitamin D / B12 deficiency',   name_zh: '維D/B12缺乏',   note: 'Common in SE Asia (low sun, vegetarian)' },
        { name_en: 'Chronic kidney/liver disease', name_zh: '慢性腎/肝病',    note: 'Check BUN/Cr, LFT' },
        { name_en: 'Malignancy / chronic infection', name_zh: '腫瘤/慢性感染', note: 'Fatigue + B-symptoms — REFER' },
      ],
    },

    // ── Menstrual irregularity ──────────────────────────────
    menstrual: {
      label_en: 'Menstrual irregularity', label_zh: '月經不調',
      triggers: /menstr|period|menorrh|amenorr|dysmenorr|月經|痛經|閉經|崩漏/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Heavy bleeding + lightheadedness / tachycardia — anaemia / haemodynamic compromise. Refer.', msg_zh: '大量出血 + 頭暈/心動過速 — 貧血/血流動力學不穩。轉診。' },
        { severity: 'high',     msg_en: 'Postmenopausal bleeding — refer for gynae evaluation (endometrial cancer until proven otherwise).', msg_zh: '絕經後出血 — 婦科評估（先排除子宮內膜癌）。' },
        { severity: 'high',     msg_en: 'Severe pelvic pain + missed period in reproductive-age woman — rule out ectopic pregnancy (β-hCG + pelvic US).', msg_zh: '育齡女性盆腔劇痛 + 停經 — 排除異位妊娠（β-hCG+盆腔超聲）。' },
        { severity: 'medium',   msg_en: 'Amenorrhoea >3 months in non-pregnant — workup: β-hCG, TSH, prolactin, FSH/LH, oestradiol.', msg_zh: '非孕停經>3月 — 評估：β-hCG、TSH、催乳素、FSH/LH、雌二醇。' },
      ],
      questions: [
        { q_en: 'LMP date, regular cycle length, flow heaviness?',              q_zh: '末次月經、週期、量？',                why: 'Baseline' },
        { q_en: 'Duration of irregularity?',                                    q_zh: '不規律時長？',                         why: 'Acute vs chronic' },
        { q_en: 'Sexual activity + contraception + pregnancy possibility?',     q_zh: '性活動、避孕、可能懷孕？',            why: 'β-hCG first' },
        { q_en: 'Pain pattern: with menses, mid-cycle, constant?',              q_zh: '疼痛時間：經期、經中、持續？',         why: 'Endometriosis vs other' },
        { q_en: 'Hair growth, acne, weight gain (PCOS)?',                       q_zh: '多毛、痤瘡、增重（PCOS）？',           why: 'PCOS screen' },
        { q_en: 'Galactorrhoea, headache, vision change (prolactinoma)?',       q_zh: '溢乳、頭痛、視覺改變（垂體瘤）？',     why: 'Pituitary screen' },
        { q_en: 'Cold intolerance, fatigue (hypothyroid)?',                     q_zh: '怕冷、疲勞（甲低）？',                why: 'Thyroid' },
        { q_en: 'Stress, weight loss, exercise (functional hypothalamic)?',      q_zh: '壓力、減重、運動（下丘腦性）？',       why: 'Functional amenorrhoea' },
      ],
      differentials: [
        { name_en: 'Pregnancy',                   name_zh: '妊娠',           note: 'Always rule out first' },
        { name_en: 'PCOS',                        name_zh: '多囊卵巢綜合徵', note: 'Irregular + androgenic features + insulin resistance' },
        { name_en: 'Hypothyroidism',              name_zh: '甲狀腺功能低下', note: 'Common cause of menorrhagia' },
        { name_en: 'Hyperprolactinaemia',         name_zh: '高催乳素血症',   note: 'Galactorrhoea + amenorrhoea' },
        { name_en: 'Functional hypothalamic',     name_zh: '功能性下丘腦性閉經', note: 'Stress, weight loss, athletes' },
        { name_en: 'Uterine fibroids / polyps',   name_zh: '子宮肌瘤/息肉', note: 'Heavy menses, intermenstrual bleeding' },
        { name_en: 'Endometriosis / adenomyosis', name_zh: '子宮內膜異位/腺肌症', note: 'Severe dysmenorrhoea, dyspareunia' },
        { name_en: 'Endometrial cancer',          name_zh: '子宮內膜癌',     note: 'Postmenopausal bleed — REFER gynae' },
      ],
    },

    // ── Anxiety / depression ────────────────────────────────
    mood: {
      label_en: 'Mood / anxiety / depression', label_zh: '情緒/焦慮/抑鬱',
      triggers: /anxiet|depress|panic|mood|焦慮|抑鬱|憂鬱|恐慌|情緒/i,
      red_flags: [
        { severity: 'critical', msg_en: 'Suicidal ideation, plan, intent, or recent attempt — refer to mental health emergency / ER same day. Do not leave patient alone.', msg_zh: '自殺意念/計畫/嘗試 — 當日轉介心理急診。勿留患者獨處。' },
        { severity: 'high',     msg_en: 'Psychotic features (hallucinations, delusions, paranoia) — psychiatric referral.', msg_zh: '精神病性症狀（幻覺、妄想、被害） — 精神科轉介。' },
        { severity: 'high',     msg_en: 'Severe functional impairment (can\'t work / self-care) for >2 weeks — refer.', msg_zh: '嚴重功能損害（無法工作/自理）>2週 — 轉介。' },
        { severity: 'medium',   msg_en: 'New mood symptoms in older adult — rule out medical causes (TSH, B12, vitamin D, brain imaging if focal).', msg_zh: '老年人新發情緒症狀 — 排除器質性（TSH、B12、維D、有局灶體徵時影像）。' },
      ],
      questions: [
        { q_en: 'Duration: weeks, months, life-long pattern?',                  q_zh: '時長：週、月、終生？',                why: 'Episode vs trait' },
        { q_en: 'PHQ-9 / GAD-7 score?',                                          q_zh: 'PHQ-9 / GAD-7 評分？',               why: 'Severity stratification' },
        { q_en: 'Suicidal ideation? Plan? Means? Past attempts?',                q_zh: '自殺意念？計畫？方法？既往嘗試？',     why: 'CRITICAL — must ask' },
        { q_en: 'Sleep, appetite, energy, concentration, libido?',               q_zh: '睡眠、食慾、精力、注意力、性慾？',     why: 'Vegetative symptoms' },
        { q_en: 'Recent stressors / losses?',                                    q_zh: '近期壓力/失落？',                    why: 'Reactive vs primary' },
        { q_en: 'Substance use: alcohol, recreational drugs?',                   q_zh: '物質：酒、毒品？',                   why: 'Frequently coexists' },
        { q_en: 'Past psychiatric hx + family hx?',                              q_zh: '過去精神疾病史 + 家族史？',           why: 'Recurrence risk' },
        { q_en: 'Medications (β-blockers, steroids, isotretinoin)?',             q_zh: '用藥（β受體阻滯劑、激素、異維A酸）？', why: 'Drug-induced' },
      ],
      differentials: [
        { name_en: 'Major depressive disorder',   name_zh: '重度抑鬱症',     note: 'PHQ-9 ≥ 10' },
        { name_en: 'Generalised anxiety disorder', name_zh: '廣泛性焦慮症',  note: 'GAD-7 ≥ 10' },
        { name_en: 'Adjustment disorder',         name_zh: '適應障礙',       note: 'Identifiable stressor, <6 months' },
        { name_en: 'Bipolar disorder',            name_zh: '雙相情感障礙',   note: 'Past hypomanic/manic episodes — REFER (DON\'T treat as unipolar)' },
        { name_en: 'PTSD',                        name_zh: '創傷後壓力',     note: 'Trauma + flashbacks + avoidance + hyperarousal' },
        { name_en: 'Hypothyroidism',              name_zh: '甲狀腺功能低下', note: 'Often presents as depression' },
        { name_en: 'Substance-induced',           name_zh: '物質性',         note: 'Alcohol, cannabis withdrawal, stimulant use' },
        { name_en: 'Dementia (in elderly)',       name_zh: '癡呆（老人）',  note: 'Pseudodementia of depression vs true cognitive decline' },
      ],
    },
  };

  // ── Public entry ─────────────────────────────────────────────
  function evaluate(input) {
    input = input || {};
    var text = (input.chief_complaint || '').toString();
    var matched = [];
    var redFlags = [];
    var questions = [];
    var differentials = [];

    // Match chief complaint to one or more catalogue entries.
    Object.keys(COMPLAINTS).forEach(function (key) {
      var entry = COMPLAINTS[key];
      if (entry.triggers && entry.triggers.test(text)) {
        matched.push({ key: key, label_en: entry.label_en, label_zh: entry.label_zh });
        (entry.red_flags    || []).forEach(function (r) { redFlags.push(Object.assign({ for_complaint: entry.label_en }, r)); });
        (entry.questions    || []).forEach(function (q) { questions.push(Object.assign({ for_complaint: entry.label_en }, q)); });
        (entry.differentials || []).forEach(function (d) { differentials.push(Object.assign({ for_complaint: entry.label_en }, d)); });
      }
    });

    return {
      matched_complaints: matched,
      red_flags:          redFlags,
      questions:          questions,
      differentials:      differentials,
      vitals_alerts:      checkVitals(input),
      source:             'The 5-Minute Clinical Consult 2017 (curated)',
    };
  }

  HM.clinicalAssist = {
    evaluate:    evaluate,
    COMPLAINTS:  COMPLAINTS,    // exposed for tests
  };
})();
