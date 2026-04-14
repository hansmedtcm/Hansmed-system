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

        // Auto-claim for pool appointments when a doctor tries to join.
        if (! $appt->doctor_id && $user->role === 'doctor') {
            $appt->doctor_id = $user->id;
            $appt->is_pool = 0;
            if (! in_array($appt->status, ['in_progress', 'completed'], true)) {
                $appt->status = 'confirmed';
            }
            $appt->save();
        }

        // Participants only (patient on the booking OR the doctor who claimed it).
        if ($appt->patient_id !== $user->id && $appt->doctor_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Allow more statuses: pool pickups may still be in 'pending_payment' or 'paid'.
        $joinable = ['pending_payment', 'paid', 'confirmed', 'in_progress'];
        if (! in_array($appt->status, $joinable, true)) {
            return response()->json(['message' => 'Appointment ' . $appt->status . ' — cannot join'], 422);
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
