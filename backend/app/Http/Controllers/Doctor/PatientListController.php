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
        // Verify doctor has seen this patient
        $hasSeen = Appointment::where('doctor_id', $request->user()->id)
            ->where('patient_id', $patientId)->exists();
        if (!$hasSeen) return response()->json(['message' => 'Forbidden'], 403);

        $diagnoses = TongueAssessment::where('patient_id', $patientId)
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($diagnoses);
    }

    /** View a patient's full consultation history with this doctor */
    public function consultationHistory(Request $request, int $patientId)
    {
        $doctorId = $request->user()->id;

        $appointments = Appointment::where('doctor_id', $doctorId)
            ->where('patient_id', $patientId)
            ->with(['prescription' => function ($q) { $q->with('items'); }])
            ->orderByDesc('scheduled_start')
            ->get();

        // Load consultations
        $apptIds = $appointments->pluck('id');
        $consultations = \App\Models\Consultation::whereIn('appointment_id', $apptIds)->get()->keyBy('appointment_id');

        foreach ($appointments as $a) {
            $a->consultation = $consultations->get($a->id);
        }

        $patient = User::with('patientProfile')->find($patientId);

        return response()->json([
            'patient'      => $patient,
            'appointments' => $appointments,
        ]);
    }
}
