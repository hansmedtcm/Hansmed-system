<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\TongueAssessment;
use App\Models\User;
use Illuminate\Http\Request;

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

        return response()->json([
            'patient'      => $patient,
            'appointments' => $appointments,
            // Hint to the frontend so it can show a 'pool review' notice
            // and label each prior consult with the actual treating doctor.
            'pool_review_access' => $hasPendingReview && $appointments->where('doctor_id', '!=', $doctorId)->count() > 0,
        ]);
    }
}
