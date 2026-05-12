<?php

namespace App\Services\WellnessAssessment;

use App\Services\WellnessAssessment\data\TreatmentBank;

/**
 * Brief #22 · Cross-references patient health screen answers against
 * the RedFlags rules baked from reference/tcm-data-tier1.xlsx.
 *
 * Input shape from Stage 5 safety_screen_answers:
 *   [
 *     'pregnancy_status'    => 'pregnant_1st_tri'|...,
 *     'current_medications' => [['name' => 'warfarin'], ...],
 *     'chronic_conditions'  => [['name' => 'CKD'], ...],
 *     'allergies'           => 'penicillin',
 *     'halal_only'          => true,
 *   ]
 *
 * Output: array of triggered RedFlag rules with full detail for the
 * doctor handoff view.
 */
class RedFlagScreener
{
    /** Returns a list of triggered RedFlag entries. Empty if patient
     *  has no contraindications. */
    public function screen(array $answers): array
    {
        $triggered = [];
        $rules = TreatmentBank::REDFLAGS;

        // 1. Pregnancy — RF01/RF02/RF03 fire if status indicates pregnancy.
        $pregStatus = $answers['pregnancy_status'] ?? null;
        $isPregnant = in_array($pregStatus, [
            'pregnant_1st_tri', 'pregnant_2nd_tri', 'pregnant_3rd_tri',
        ], true);
        $isFirstTri = $pregStatus === 'pregnant_1st_tri';
        if ($isPregnant) {
            foreach (['RF01','RF03'] as $rid) {
                if (isset($rules[$rid])) {
                    $triggered[] = $this->annotate($rules[$rid], "Patient is pregnant ({$pregStatus})");
                }
            }
            if ($isFirstTri && isset($rules['RF02'])) {
                $triggered[] = $this->annotate($rules['RF02'], 'First trimester — extra caution');
            }
        }

        // 2. Drug interactions — match medication names against the
        //    rule's condition text (case-insensitive substring).
        $meds = (array) ($answers['current_medications'] ?? []);
        $medNames = [];
        foreach ($meds as $m) {
            $name = is_array($m) ? ($m['name'] ?? '') : (string) $m;
            if ($name !== '') $medNames[] = strtolower($name);
        }

        $drugRules = [
            'RF04' => ['warfarin', 'doac', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban'],
            'RF05' => ['digoxin'],
            'RF06' => ['ssri', 'maoi', 'fluoxetine', 'sertraline', 'escitalopram', 'citalopram', 'paroxetine'],
            'RF07' => ['amlodipine', 'losartan', 'enalapril', 'lisinopril', 'metoprolol', 'bisoprolol', 'atenolol', 'hydrochlorothiazide'],
        ];
        foreach ($drugRules as $rid => $keywords) {
            foreach ($keywords as $kw) {
                foreach ($medNames as $name) {
                    if (str_contains($name, $kw)) {
                        if (isset($rules[$rid])) {
                            $triggered[] = $this->annotate($rules[$rid], "Patient on '{$name}'");
                        }
                        break 2;
                    }
                }
            }
        }

        // 3. Chronic conditions — match by keyword.
        $conds = (array) ($answers['chronic_conditions'] ?? []);
        $condNames = [];
        foreach ($conds as $c) {
            $name = is_array($c) ? ($c['name'] ?? '') : (string) $c;
            if ($name !== '') $condNames[] = strtolower($name);
        }
        $condRules = [
            'RF08' => ['hypertension', 'high blood pressure', 'htn'],
            'RF09' => ['arrhythmia', 'afib', 'atrial fibrillation'],
            'RF13' => ['ckd', 'kidney disease', 'renal failure', 'nephritis'],
            'RF14' => ['liver disease', 'cirrhosis', 'hepatitis'],
            'RF15' => ['gi bleed', 'peptic ulcer', 'gastric bleed'],
        ];
        foreach ($condRules as $rid => $keywords) {
            foreach ($keywords as $kw) {
                foreach ($condNames as $name) {
                    if (str_contains($name, $kw)) {
                        if (isset($rules[$rid])) {
                            $triggered[] = $this->annotate($rules[$rid], "Patient has '{$name}'");
                        }
                        break 2;
                    }
                }
            }
        }

        // 4. Halal preference — RF10 + RF11.
        if (! empty($answers['halal_only'])) {
            foreach (['RF10','RF11'] as $rid) {
                if (isset($rules[$rid])) {
                    $triggered[] = $this->annotate($rules[$rid], 'Patient prefers halal-only');
                }
            }
        }

        // 5. Allergies — RF16.
        $allergies = trim((string) ($answers['allergies'] ?? ''));
        if ($allergies !== '' && strtolower($allergies) !== 'none' && isset($rules['RF16'])) {
            $triggered[] = $this->annotate($rules['RF16'], "Reported allergies: {$allergies}");
        }

        // Note: RF12 (paediatric) requires age from PatientProfile, which we
        // do not pass into the screener here — caller should handle that if
        // patient.birth_date indicates age < 12.

        return $triggered;
    }

    /** Add a `triggered_by` annotation explaining why the rule fired. */
    private function annotate(array $rule, string $reason): array
    {
        return $rule + ['triggered_by' => $reason];
    }
}
