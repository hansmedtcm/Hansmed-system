<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Services\AgoraTokenService;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    public function __construct(private AgoraTokenService $agora) {}

    /**
     * Issue an Agora RTC join token for an appointment.
     * Both patient & doctor call this (E-61). The caller must be a participant.
     */
    public function joinToken(Request $request, int $appointmentId)
    {
        $user = $request->user();
        $appt = Appointment::findOrFail($appointmentId);

        if ($appt->patient_id !== $user->id && $appt->doctor_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (! in_array($appt->status, ['confirmed', 'in_progress'], true)) {
            return response()->json(['message' => 'Appointment not joinable'], 422);
        }

        $consult = Consultation::firstOrCreate(
            ['appointment_id' => $appt->id],
            ['room_id' => 'appt-' . $appt->id]
        );

        $token = $this->agora->buildRtcToken(
            channel: $consult->room_id,
            uid: $user->id,
            ttlSeconds: 3600,
        );

        return response()->json([
            'consultation' => $consult,
            'rtc'          => $token,
            'role'         => $user->role,
        ]);
    }

    // Called by doctor after video ends — persist notes + duration
    public function finish(Request $request, int $appointmentId)
    {
        $data = $request->validate([
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
            'doctor_notes'     => ['nullable', 'string', 'max:5000'],
            'transcript'       => ['nullable', 'string'],
        ]);

        $appt = Appointment::where('doctor_id', $request->user()->id)
            ->findOrFail($appointmentId);

        $consult = Consultation::where('appointment_id', $appt->id)->firstOrFail();
        $consult->update([
            'ended_at'         => now(),
            'duration_seconds' => $data['duration_seconds'] ?? null,
            'doctor_notes'     => $data['doctor_notes']     ?? null,
            'transcript'       => $data['transcript']       ?? null,
        ]);

        return response()->json(['consultation' => $consult]);
    }
}
