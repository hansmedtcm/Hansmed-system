<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Brief #22 · One pre-assessment row per pre-consultation intake session.
 *
 * Created when patient starts the assessment (status=in_progress, stage=1).
 * Each stage submission patches the relevant fields. status flips to
 * 'complete' on stage 5 submission.
 *
 * Doctor view consumes the "complete" rows tied to an appointment via
 * Doctor\PreAssessmentController. Patient view consumes their own
 * "in_progress" or "complete" rows via Patient\PreAssessmentController.
 *
 * SECURITY NOTE: this row holds the clinical hypothesis. Patient must
 * NEVER receive any field that reveals the diagnosis (tcm_top_patterns,
 * clinical_assist_output, red_flags_detected, suggested_treatments).
 * The patient-side controller filters those out before returning JSON.
 */
class PreAssessment extends Model
{
    use HasFactory;

    protected $fillable = [
        'appointment_id',
        'patient_id',
        'tongue_assessment_id',
        'chief_complaint',
        'symptom_timeline',
        'western_history_answers',
        'clinical_assist_output',
        'vitals',
        'tcm_top_patterns',
        'tcm_selected_questions',
        'tcm_answers',
        'safety_screen_answers',
        'red_flags_detected',
        'suggested_treatments',
        'doctor_decision',
        'doctor_decision_notes',
        'doctor_decided_by',
        'doctor_decided_at',
        'status',
        'completed_at',
        'current_stage',
    ];

    protected $casts = [
        'western_history_answers' => 'array',
        'clinical_assist_output'  => 'array',
        'vitals'                  => 'array',
        'tcm_top_patterns'        => 'array',
        'tcm_selected_questions'  => 'array',
        'tcm_answers'             => 'array',
        'safety_screen_answers'   => 'array',
        'red_flags_detected'      => 'array',
        'suggested_treatments'    => 'array',
        'doctor_decided_at'       => 'datetime',
        'completed_at'            => 'datetime',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function tongueAssessment(): BelongsTo
    {
        return $this->belongsTo(TongueAssessment::class);
    }

    public function decidedByDoctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_decided_by');
    }

    // ── Patient-safe JSON view ───────────────────────────────────
    //
    // Strips the diagnostic content before returning to the patient.
    // Used by Patient\PreAssessmentController so the patient can resume
    // an in-progress assessment without seeing the AI's hypothesis.

    public function patientSafePayload(): array
    {
        return [
            'id'               => $this->id,
            'appointment_id'   => $this->appointment_id,
            'chief_complaint'  => $this->chief_complaint,
            'symptom_timeline' => $this->symptom_timeline,
            // Note: NOT including clinical_assist_output, tcm_top_patterns,
            // red_flags_detected, suggested_treatments — those are doctor-only.
            // Patient resuming an in-progress assessment sees only what they
            // entered themselves, never the AI's interpretation.
            'western_history_answers' => $this->western_history_answers,
            'vitals'                  => $this->vitals,
            'tcm_answers'             => $this->tcm_answers,
            'safety_screen_answers'   => $this->safety_screen_answers,
            'status'                  => $this->status,
            'current_stage'           => $this->current_stage,
            'created_at'              => $this->created_at,
            'updated_at'              => $this->updated_at,
        ];
    }
}
