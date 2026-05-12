<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\PreAssessment;
use App\Models\TongueAssessment;
use App\Services\WellnessAssessment\AdaptiveQuestionSelector;
use App\Services\WellnessAssessment\RedFlagScreener;
use App\Services\WellnessAssessment\TreatmentSuggester;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Brief #22 · Patient-facing pre-assessment endpoints.
 *
 * Routes (auth: sanctum, role: patient):
 *   POST   /api/patient/pre-assessment/start
 *   GET    /api/patient/pre-assessment/{id}
 *   PATCH  /api/patient/pre-assessment/{id}/stage/{stage}
 *
 * SECURITY: every response goes through PreAssessment::patientSafePayload()
 * so the patient never sees the AI's diagnosis, the TCM pattern hypothesis,
 * the Western differentials, the red-flag breakdown, or the suggested
 * treatment. Those fields are doctor-only — they live on the model but
 * patientSafePayload() filters them out.
 */
class PreAssessmentController extends Controller
{
    /**
     * POST /api/patient/pre-assessment/start
     *
     * Creates a new in-progress pre-assessment or resumes one. Returns
     * the patient-safe payload + the existing PatientProfile baseline
     * so the frontend knows what to skip in stage 5 (Hybrid 1C).
     */
    public function start(Request $request)
    {
        $request->validate([
            'appointment_id' => ['nullable', 'integer', 'exists:appointments,id'],
        ]);
        $user = $request->user();

        // Look for an in-progress assessment to resume (per appointment if
        // provided, else per patient).
        $existing = PreAssessment::where('patient_id', $user->id)
            ->where('status', 'in_progress')
            ->when($request->appointment_id, fn ($q) =>
                $q->where('appointment_id', $request->appointment_id))
            ->orderByDesc('id')
            ->first();

        if ($existing) {
            return response()->json([
                'pre_assessment' => $existing->patientSafePayload(),
                'profile_baseline' => $this->profileBaseline($user),
                'resumed' => true,
            ]);
        }

        $pa = PreAssessment::create([
            'patient_id'      => $user->id,
            'appointment_id'  => $request->appointment_id,
            'chief_complaint' => '', // filled at stage 1 submit
            'status'          => 'in_progress',
            'current_stage'   => 1,
        ]);
        return response()->json([
            'pre_assessment' => $pa->patientSafePayload(),
            'profile_baseline' => $this->profileBaseline($user),
            'resumed' => false,
        ], 201);
    }

    /** GET /api/patient/pre-assessment/{id} — resume / inspect own. */
    public function show(Request $request, int $id)
    {
        $pa = PreAssessment::where('patient_id', $request->user()->id)
            ->where('id', $id)->firstOrFail();
        return response()->json(['pre_assessment' => $pa->patientSafePayload()]);
    }

    /**
     * PATCH /api/patient/pre-assessment/{id}/stage/{stage}
     *
     * Stage-specific update. Each stage validates only the fields it
     * needs. On stage 3 submit (tongue done) we kick off the adaptive
     * question selector and return the questions for stage 4. On stage 5
     * submit we cross-reference RedFlags + run TreatmentSuggester +
     * mark the assessment complete.
     */
    public function updateStage(Request $request, int $id, int $stage)
    {
        $pa = PreAssessment::where('patient_id', $request->user()->id)
            ->where('id', $id)->firstOrFail();

        if ($pa->status !== 'in_progress') {
            return response()->json(['message' => 'Assessment already completed'], 409);
        }
        if ($stage < 1 || $stage > 5) {
            return response()->json(['message' => 'Invalid stage'], 422);
        }

        return DB::transaction(function () use ($request, $pa, $stage) {
            $extra = [];
            switch ($stage) {
                case 1:
                    $data = $request->validate([
                        'chief_complaint'  => ['required', 'string', 'min:2', 'max:1000'],
                        'symptom_timeline' => ['nullable', 'string', 'max:1000'],
                    ]);
                    $pa->fill($data);
                    break;
                case 2:
                    $data = $request->validate([
                        'western_history_answers' => ['nullable', 'array'],
                        'clinical_assist_output'  => ['nullable', 'array'],
                        'vitals'                  => ['nullable', 'array'],
                    ]);
                    $pa->fill($data);
                    break;
                case 3:
                    $data = $request->validate([
                        'tongue_assessment_id' => ['required', 'integer', 'exists:tongue_assessments,id'],
                    ]);
                    // Verify the tongue assessment belongs to this patient
                    $ta = TongueAssessment::find($data['tongue_assessment_id']);
                    if (! $ta || $ta->patient_id !== $pa->patient_id) {
                        return response()->json(['message' => 'Tongue assessment not yours'], 403);
                    }
                    $pa->tongue_assessment_id = $ta->id;
                    // Extract top-2 patterns from the tongue analysis result
                    // and ask the AdaptiveQuestionSelector to pick the questions.
                    $extra['tcm_questions'] = $this->prepareStage4Questions($pa, $ta);
                    break;
                case 4:
                    // 2026-05-12 — relaxed from required to nullable. When
                    // AdaptiveQuestionSelector returns zero questions (rare
                    // umbrella patterns or deterministic-only mode), the
                    // patient legitimately has nothing to answer — but the
                    // old 'required' rule rejected the empty submission and
                    // froze the flow at Stage 4.
                    $data = $request->validate([
                        'tcm_answers' => ['nullable', 'array'],
                    ]);
                    $pa->tcm_answers = $data['tcm_answers'] ?? [];
                    break;
                case 5:
                    // 2026-05-12 — relaxed from required to nullable for the
                    // same reason as Stage 4: if the patient has no extra
                    // safety screen items to answer, the flow should still
                    // close cleanly. finalizeAssessment runs regardless.
                    $data = $request->validate([
                        'safety_screen_answers' => ['nullable', 'array'],
                    ]);
                    $pa->safety_screen_answers = $data['safety_screen_answers'] ?? [];
                    $this->finalizeAssessment($pa);
                    break;
            }

            $pa->current_stage = max($pa->current_stage, $stage + 1);
            $pa->save();
            return response()->json([
                'pre_assessment' => $pa->patientSafePayload(),
            ] + $extra);
        });
    }

    /** Helper — pull the latest PatientProfile values so frontend can
     *  pre-fill stage 5 (Hybrid 1C: skip what we already know). */
    private function profileBaseline($user): array
    {
        $p = $user->patientProfile;
        if (! $p) return [];
        return [
            'current_medications' => $p->current_medications,
            'chronic_conditions'  => $p->chronic_conditions ?? null,
            'allergies'           => $p->allergies,
            'halal_only'          => $p->halal_only ?? null,
            'pregnancy_status'    => $p->pregnancy_status ?? null,
            'pregnancy_status_updated_at' => $p->pregnancy_status_updated_at ?? null,
        ];
    }

    /** Stage 3 → Stage 4 bridge: extract top patterns from tongue
     *  analysis, ask AdaptiveQuestionSelector to pick questions. */
    private function prepareStage4Questions(PreAssessment $pa, TongueAssessment $ta): array
    {
        // Parse the tongue analysis result — schema varies by client
        // (AnthropicTongueClient or third-party). Defensive extraction.
        $analysis = is_string($ta->analysis_json ?? null)
            ? json_decode($ta->analysis_json, true)
            : ($ta->analysis_json ?? []);
        $topPatterns = $analysis['top_patterns'] ?? $analysis['patterns'] ?? [];
        $tongueSigns = $analysis['tongue_signs'] ?? $analysis['signs'] ?? [];

        // Normalise top patterns to ['pattern', 'confidence'] shape
        $normalised = [];
        foreach ((array) $topPatterns as $p) {
            if (is_array($p) && isset($p['pattern'])) {
                $normalised[] = [
                    'pattern'    => $p['pattern'],
                    'confidence' => (float) ($p['confidence'] ?? 0),
                ];
            }
        }

        $selector = app(AdaptiveQuestionSelector::class);
        $selections = $selector->select($normalised, (array) $tongueSigns);

        // Persist the selection record for audit + so we can render the
        // questions on stage 4 even if the patient refreshes.
        $pa->tcm_top_patterns        = $normalised;
        $pa->tcm_selected_questions  = $selections;

        return $selections;
    }

    /** Stage 5 submission: red-flag screen + treatment suggestion + mark complete. */
    private function finalizeAssessment(PreAssessment $pa): void
    {
        $screener = app(RedFlagScreener::class);
        $pa->red_flags_detected = $screener->screen($pa->safety_screen_answers ?? []);

        $suggester = app(TreatmentSuggester::class);
        $pa->suggested_treatments = $suggester->suggest(
            $pa->tcm_top_patterns ?? [],
            $pa->red_flags_detected ?? []
        );

        // Update PatientProfile baseline (Hybrid 1C).
        $user = $pa->patient;
        $p = $user?->patientProfile;
        if ($p) {
            $answers = $pa->safety_screen_answers ?? [];
            $update = [];
            if (isset($answers['current_medications']))
                $update['current_medications'] = $answers['current_medications'];
            if (isset($answers['chronic_conditions']))
                $update['chronic_conditions']  = $answers['chronic_conditions'];
            if (isset($answers['allergies']))
                $update['allergies']           = $answers['allergies'];
            if (isset($answers['halal_only']))
                $update['halal_only']          = (bool) $answers['halal_only'];
            if (isset($answers['pregnancy_status'])) {
                $update['pregnancy_status']    = $answers['pregnancy_status'];
                $update['pregnancy_status_updated_at'] = now();
            }
            if (! empty($update)) $p->update($update);
        }

        $pa->status = 'complete';
        $pa->completed_at = now();
    }
}
