<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    /** Generate prescription PDF (HTML rendered for browser print) */
    public function prescriptionPdf(Request $request, int $id)
    {
        $rx = Prescription::with(['items', 'doctor.doctorProfile', 'patient.patientProfile'])
            ->findOrFail($id);

        // Verify access: doctor who issued it, the patient, or admin
        $user = $request->user();
        if ($user->id !== $rx->doctor_id && $user->id !== $rx->patient_id && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $doctor = $rx->doctor->doctorProfile ?? null;
        $patient = $rx->patient->patientProfile ?? null;

        return response()->view('documents.prescription', [
            'rx'      => $rx,
            'doctor'  => $doctor,
            'patient' => $patient,
        ]);
    }

    /** Generate Medical Certificate (MC) */
    public function medicalCertificate(Request $request)
    {
        $data = $request->validate([
            'patient_id'    => ['required', 'integer'],
            'appointment_id'=> ['required', 'integer'],
            'days'          => ['required', 'integer', 'min:1', 'max:14'],
            'start_date'    => ['required', 'date'],
            'diagnosis'     => ['required', 'string', 'max:500'],
            'remarks'       => ['nullable', 'string', 'max:500'],
        ]);

        $doctor = $request->user()->doctorProfile;
        $patient = User::findOrFail($data['patient_id'])->patientProfile;

        return response()->view('documents.mc', [
            'data'    => $data,
            'doctor'  => $doctor,
            'patient' => $patient,
        ]);
    }

    /** Generate Referral Letter */
    public function referralLetter(Request $request)
    {
        $data = $request->validate([
            'patient_id'     => ['required', 'integer'],
            'referred_to'    => ['required', 'string', 'max:200'],
            'specialty'      => ['nullable', 'string', 'max:120'],
            'diagnosis'      => ['required', 'string', 'max:500'],
            'reason'         => ['required', 'string', 'max:1000'],
            'clinical_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $doctor = $request->user()->doctorProfile;
        $patient = User::findOrFail($data['patient_id'])->patientProfile;

        return response()->view('documents.referral', [
            'data'    => $data,
            'doctor'  => $doctor,
            'patient' => $patient,
        ]);
    }
}
