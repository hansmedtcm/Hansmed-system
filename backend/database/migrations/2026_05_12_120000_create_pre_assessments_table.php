<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Brief #22 · pre_assessments — single row per patient pre-consult intake.
     *
     * Aggregates everything the doctor needs to see *before* a consultation:
     *   - chief complaint + symptom timeline (Stage 1 of patient flow)
     *   - Western history answers + HM.clinicalAssist output (Stage 2)
     *   - tongue_assessment_id FK to existing tongue assessment (Stage 3)
     *   - TCM top-2 patterns + answers from PatternQuestionBank (Stage 4)
     *   - safety screen answers + red flags detected (Stage 5)
     *   - suggested treatment payload (TreatmentSuggester output)
     *   - doctor decision (confirmed / amended / overridden) + notes
     *
     * Patient never sees the diagnostic content; doctor reviews before consult.
     * See briefs/brief-22-preassessment-spec.md for full design rationale.
     */
    public function up(): void
    {
        Schema::create('pre_assessments', function (Blueprint $table) {
            $table->id();

            // Nullable so a patient can do a walk-up pre-assessment before
            // booking — the appointment is associated later.
            $table->unsignedBigInteger('appointment_id')->nullable();
            $table->unsignedBigInteger('patient_id');
            $table->unsignedBigInteger('tongue_assessment_id')->nullable();

            // Stage 1 — chief complaint
            $table->text('chief_complaint');
            $table->text('symptom_timeline')->nullable();

            // Stage 2 — Western history + vitals
            // clinical_assist_output is the full HM.clinicalAssist.evaluate()
            // payload captured at patient submission, including differentials,
            // red_flags, suggested questions, and vitals_alerts. The doctor
            // view renders straight from this — no re-computation needed.
            $table->json('western_history_answers')->nullable();
            $table->json('clinical_assist_output')->nullable();
            $table->json('vitals')->nullable();

            // Stage 4 — TCM
            // tcm_top_patterns: [{ pattern, confidence, syndrome_id, name }, ...]
            // tcm_selected_questions: audit trail of which Qs were asked + why
            // tcm_answers: { 'sy12-q1': 'yes', 'sy12-q3': 4, ... }
            $table->json('tcm_top_patterns')->nullable();
            $table->json('tcm_selected_questions')->nullable();
            $table->json('tcm_answers')->nullable();

            // Stage 5 — safety + RedFlags
            $table->json('safety_screen_answers')->nullable();
            $table->json('red_flags_detected')->nullable();

            // §11 addendum — TreatmentSuggester output
            $table->json('suggested_treatments')->nullable();

            // Doctor decision (Stage 6 of doctor handoff flow)
            $table->enum('doctor_decision', ['pending', 'confirmed', 'amended', 'overridden'])
                  ->default('pending');
            $table->text('doctor_decision_notes')->nullable();
            $table->unsignedBigInteger('doctor_decided_by')->nullable();
            $table->dateTime('doctor_decided_at')->nullable();

            // Patient flow status
            $table->enum('status', ['in_progress', 'complete', 'abandoned'])
                  ->default('in_progress');
            $table->dateTime('completed_at')->nullable();
            $table->unsignedTinyInteger('current_stage')->default(1);

            $table->timestamps();

            // Indexes for the most-common queries:
            //   - doctor opens patient detail → look up by appointment_id
            //   - patient resumes in-progress → look up by patient_id + status
            $table->index(['patient_id', 'status'], 'idx_pa_patient_status');
            $table->index('appointment_id', 'idx_pa_appointment');

            // Foreign keys. ON DELETE behaviour:
            //   - patient deleted → cascade (their pre-assessment is gone too)
            //   - appointment deleted → set null (assessment may pre-date booking)
            //   - tongue assessment deleted → set null (assessment data survives)
            //   - doctor deleted → set null (decision audit trail survives)
            $table->foreign('patient_id')
                  ->references('id')->on('users')
                  ->onDelete('cascade');
            $table->foreign('appointment_id')
                  ->references('id')->on('appointments')
                  ->onDelete('set null');
            $table->foreign('tongue_assessment_id')
                  ->references('id')->on('tongue_assessments')
                  ->onDelete('set null');
            $table->foreign('doctor_decided_by')
                  ->references('id')->on('users')
                  ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pre_assessments');
    }
};
