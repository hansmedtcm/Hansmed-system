<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\TongueAssessment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PatientListController extends Controller
{
    /** List all patients this doctor has seen */
    public function index(Request $request)
    {
        $doctorId = $request->user()->id;

        $patientIds = Appointment::where('doctor_id', $doctorId)
            ->distinct()
            ->pluck('patient_id');

        $q = User::whereIn('id', $patientIds)
            ->where('role', 'patient')
            ->with('patientProfile');

        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('email', 'like', "%{$s}%")
                  ->orWhereHas('patientProfile', fn($p) =>
                    $p->where('full_name', 'like', "%{$s}%")
                      ->orWhere('ic_number', 'like', "%{$s}%")
                      ->orWhere('phone', 'like', "%{$s}%"));
            });
        }

        $patients = $q->orderByDesc('id')->paginate(30);

        // Enrich with appointment count and last visit
        foreach ($patients as $p) {
            $p->appointment_count = Appointment::where('doctor_id', $doctorId)
                ->where('patient_id', $p->id)->count();
            $p->last_visit = Appointment::where('doctor_id', $doctorId)
                ->where('patient_id', $p->id)
                ->where('status', 'completed')
                ->orderByDesc('scheduled_start')
                ->value('scheduled_start');
        }

        return response()->json($patients);
    }

    /** View a patient's tongue diagnosis history */
    public function tongueDiagnoses(Request $request, int $patientId)
    {
        $doctorId = $request->user()->id;

        // Access is granted if EITHER:
        //   (a) the doctor has previously had an appointment with this
        //       patient (the original 'I've seen them' rule), OR
        //   (b) the patient currently has a pending AI review in the
        //       shared review pool — any doctor could pick that up next,
        //       and they need the tongue history to make an informed
        //       clinical judgment. Without this, opening the AI Reviews
        //       queue for a patient you haven't yet seen renders an
        //       empty 'Recent Tongue Scans' panel even though the data
        //       exists.
        $hasSeen = Appointment::where('doctor_id', $doctorId)
            ->where('patient_id', $patientId)
            ->exists();

        $hasPendingReview = false;
        if (! $hasSeen) {
            $hasPendingReview = TongueAssessment::where('patient_id', $patientId)
                ->where('review_status', 'pending')
                ->exists();
        }

        if (! $hasSeen && ! $hasPendingReview) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $diagnoses = TongueAssessment::where('patient_id', $patientId)
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($diagnoses);
    }

    /**
     * View a patient's consultation history.
     *
     * Default scope: only consultations the requesting doctor personally
     * conducted (privacy default — Doctor A doesn't routinely see what
     * Doctor B wrote about the same patient).
     *
     * Widened scope: when the patient is currently in the AI review pool
     * (any TongueAssessment row with review_status='pending'), the
     * reviewer sees consultations from EVERY doctor on the patient. Per
     * clinic norms, reviewers want to read prior case notes before
     * deciding whether to pick up the case.
     */
    public function consultationHistory(Request $request, int $patientId)
    {
        $doctorId = $request->user()->id;

        // Is this patient in the shared review pool right now?
        $hasPendingReview = TongueAssessment::where('patient_id', $patientId)
            ->where('review_status', 'pending')
            ->exists();

        $apptQuery = Appointment::where('patient_id', $patientId)
            ->with(['prescription' => function ($q) { $q->with('items'); }])
            ->orderByDesc('scheduled_start');

        if (! $hasPendingReview) {
            // Normal access: only my own consultations with this patient.
            $apptQuery->where('doctor_id', $doctorId);
        }
        // Else: pool reviewer — see all doctors' history with this patient.

        $appointments = $apptQuery->get();

        // Load consultations
        $apptIds = $appointments->pluck('id');
        $consultations = \App\Models\Consultation::whereIn('appointment_id', $apptIds)->get()->keyBy('appointment_id');

        // Tag who the treating doctor was on each appointment so the UI
        // can show 'Reviewed by Mr. Lim' style labels rather than
        // implying every consult was by the current viewer.
        $treatingDoctorIds = $appointments->pluck('doctor_id')->filter()->unique();
        $treatingDoctors   = User::whereIn('id', $treatingDoctorIds)
            ->with('doctorProfile')->get()->keyBy('id');

        foreach ($appointments as $a) {
            $a->consultation = $consultations->get($a->id);
            $td = $a->doctor_id ? $treatingDoctors->get($a->doctor_id) : null;
            $a->treating_doctor_name = $td
                ? ($td->doctorProfile->full_name ?? $td->email)
                : null;
        }

        $patient = User::with('patientProfile')->find($patientId);

        // Brief #5 Task A — surface this patient's AI Constitution
        // Questionnaire history alongside the consultation list so the
        // doctor can see self-reports without leaving the patient page.
        // Schema reality (verified from backend/database/schema.sql):
        // the questionnaires table only has id / patient_id / symptoms /
        // lifestyle / diet / discomfort_areas / created_at — there is
        // NO kind/status/reviewed_by/reviewed_at column. All review
        // metadata lives inside the symptoms JSON blob, matching the
        // pattern in ConstitutionReviewController::index (lines 30-66).
        // Mirror that controller's response shape exactly so any code
        // that consumes a questionnaire learns one shape.
        $questionnaires = $this->loadConstitutionQuestionnaires($patientId);

        return response()->json([
            'patient'      => $patient,
            'appointments' => $appointments,
            // Hint to the frontend so it can show a 'pool review' notice
            // and label each prior consult with the actual treating doctor.
            'pool_review_access' => $hasPendingReview && $appointments->where('doctor_id', '!=', $doctorId)->count() > 0,
            // Brief #5: AI Constitution Questionnaire history. Empty
            // array on schema mismatch / decode failure (defensive).
            'questionnaires' => $questionnaires,
        ]);
    }

    /**
     * Load this patient's AI Constitution Questionnaire submissions in
     * a flattened shape that matches ConstitutionReviewController. The
     * questionnaires table stores all review metadata + the kind tag
     * inside the symptoms JSON column; we decode it server-side and
     * surface review_status / reviewed_by / reviewed_at / review_note /
     * kind as flat fields on the response object so the frontend
     * doesn't have to dig into a nested blob. Patient self-report
     * fields (symptoms minus the metadata, plus lifestyle / diet /
     * discomfort_areas) are also decoded so the frontend can render
     * them directly. Defensive: any failure → empty array logged.
     */
    private function loadConstitutionQuestionnaires(int $patientId): array
    {
        try {
            $rows = DB::table('questionnaires')
                ->where('patient_id', $patientId)
                ->orderByDesc('created_at')
                ->limit(20)
                ->get();

            $out = [];
            foreach ($rows as $row) {
                $symptoms = is_string($row->symptoms ?? null)
                    ? (json_decode($row->symptoms, true) ?: [])
                    : ($row->symptoms ?? []);

                // Filter to ai_constitution_v2 — non-constitution
                // questionnaires (if any are added later) are
                // intentionally excluded from this section.
                if (($symptoms['kind'] ?? '') !== 'ai_constitution_v2') {
                    continue;
                }

                $lifestyle = is_string($row->lifestyle ?? null)
                    ? (json_decode($row->lifestyle, true) ?: [])
                    : ($row->lifestyle ?? []);
                $diet = is_string($row->diet ?? null)
                    ? (json_decode($row->diet, true) ?: [])
                    : ($row->diet ?? []);
                $discomfort = is_string($row->discomfort_areas ?? null)
                    ? (json_decode($row->discomfort_areas, true) ?: [])
                    : ($row->discomfort_areas ?? []);

                $out[] = [
                    'id'             => $row->id,
                    'created_at'     => $row->created_at,
                    'kind'           => $symptoms['kind'] ?? null,
                    // Review metadata pulled out of the symptoms blob
                    // — same flat shape ConstitutionReviewController
                    // returns, so any UI written against that endpoint
                    // can be reused here without translation.
                    'review_status'  => $symptoms['review_status']  ?? 'pending',
                    'reviewed_by'    => $symptoms['reviewed_by']    ?? null,
                    'reviewed_at'    => $symptoms['reviewed_at']    ?? null,
                    'review_note'    => $symptoms['review_note']    ?? null,
                    // Patient self-report fields — symptoms (full blob,
                    // contains chief_concern + the 10-dim answers + the
                    // review metadata; frontend reads chief_concern out
                    // of it), lifestyle / diet / discomfort_areas are
                    // already-decoded objects.
                    'symptoms'         => $symptoms,
                    'lifestyle'        => $lifestyle,
                    'diet'             => $diet,
                    'discomfort_areas' => $discomfort,
                ];
            }
            return $out;
        } catch (\Throwable $e) {
            Log::warning('PatientListController: questionnaires lookup failed for patient ' . $patientId . ': ' . $e->getMessage());
            return [];
        }
    }
}
