<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    // D-04: list doctor's appointments by status
    public function index(Request $request)
    {
        // Show appointments assigned to this doctor PLUS unclaimed pool
        // appointments so the doctor sees everything they could pick up.
        $uid = $request->user()->id;
        $q = Appointment::with(['patient.patientProfile'])
            ->where(function ($w) use ($uid) {
                $w->where('doctor_id', $uid)
                  ->orWhere(function ($pool) {
                      $pool->whereNull('doctor_id')->where('is_pool', 1);
                  });
            });

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return response()->json(
            $q->orderByDesc('scheduled_start')->paginate(20)
        );
    }

    // D-05 / D-06: view appointment with patient + tongue report
    public function show(Request $request, int $id)
    {
        $uid = $request->user()->id;
        $appt = Appointment::with(['patient.patientProfile'])
            ->where(function ($w) use ($uid) {
                $w->where('doctor_id', $uid)
                  ->orWhere(function ($pool) {
                      $pool->whereNull('doctor_id')->where('is_pool', 1);
                  });
            })
            ->findOrFail($id);

        $tongue = $appt->tongue_diagnosis_id
            ? \App\Models\TongueDiagnosis::find($appt->tongue_diagnosis_id)
            : null;

        return response()->json([
            'appointment'      => $appt,
            'tongue_diagnosis' => $tongue,
        ]);
    }

    // Doctor creates an appointment for an existing patient (no payment required)
    public function storeForPatient(\Illuminate\Http\Request $request)
    {
        $data = $request->validate([
            'patient_id'      => ['required', 'integer', 'exists:users,id'],
            'scheduled_start' => ['required', 'date'],
            'scheduled_end'   => ['required', 'date', 'after:scheduled_start'],
            'fee'             => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            'concern'         => ['nullable', 'string', 'max:60'],
            'concern_label'   => ['nullable', 'string', 'max:120'],
            'recommended_specialty' => ['nullable', 'string', 'max:120'],
            'visit_type'      => ['nullable', 'in:online,walk_in'],
        ]);

        // Verify patient exists and has correct role
        $patient = \App\Models\User::where('id', $data['patient_id'])
            ->where('role', 'patient')
            ->firstOrFail();

        // Prevent double-booking the doctor
        $conflict = Appointment::where('doctor_id', $request->user()->id)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->where('scheduled_start', '<', $data['scheduled_end'])
            ->where('scheduled_end',   '>', $data['scheduled_start'])
            ->exists();
        if ($conflict) {
            return response()->json(['message' => 'You already have an appointment in this slot'], 422);
        }

        $appt = Appointment::create([
            'patient_id'             => $data['patient_id'],
            'doctor_id'              => $request->user()->id,
            'scheduled_start'        => $data['scheduled_start'],
            'scheduled_end'          => $data['scheduled_end'],
            'status'                 => 'confirmed',
            'fee'                    => $data['fee'] ?? 0,
            'notes'                  => $data['notes'] ?? null,
            'concern'                => $data['concern'] ?? null,
            'concern_label'          => $data['concern_label'] ?? null,
            'recommended_specialty'  => $data['recommended_specialty'] ?? null,
            'is_pool'                => 0,
            'visit_type'             => $data['visit_type'] ?? 'online',
        ]);

        return response()->json(['appointment' => $appt], 201);
    }

    // D-07 hook: mark consultation started/ended
    public function start(Request $request, int $id)
    {
        // Accept pool appointments too — if they haven't been picked, assign to current doctor.
        $appt = Appointment::findOrFail($id);
        if (! $appt->doctor_id) {
            $appt->doctor_id = $request->user()->id;
            $appt->is_pool = 0;
        } elseif ($appt->doctor_id !== $request->user()->id) {
            return response()->json(['message' => 'Not your appointment'], 403);
        }

        if (in_array($appt->status, ['completed', 'cancelled', 'no_show'], true)) {
            return response()->json(['message' => 'Appointment already ' . $appt->status], 422);
        }

        // Any pre-consult state (pending_payment, paid, confirmed) → in_progress.
        $appt->status = 'in_progress';
        $appt->save();
        return response()->json(['appointment' => $appt]);
    }

    public function complete(Request $request, int $id)
    {
        $appt = Appointment::where('doctor_id', $request->user()->id)->findOrFail($id);
        $appt->update(['status' => 'completed']);
        return response()->json(['appointment' => $appt]);
    }
}
