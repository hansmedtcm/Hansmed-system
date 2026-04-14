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
        $q = Appointment::where('doctor_id', $request->user()->id);

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
        $appt = Appointment::where('doctor_id', $request->user()->id)
            ->with(['patient.patientProfile'])
            ->findOrFail($id);

        $tongue = $appt->tongue_diagnosis_id
            ? \App\Models\TongueDiagnosis::find($appt->tongue_diagnosis_id)
            : null;

        return response()->json([
            'appointment'      => $appt,
            'tongue_diagnosis' => $tongue,
        ]);
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
