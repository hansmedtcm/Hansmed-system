<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Consultation;
use App\Services\AgoraTokenService;
use App\Services\DailyClient;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    public function __construct(private AgoraTokenService $agora) {}

    /**
     * Issue a Daily.co room URL + meeting token for an appointment.
     * Replaces the meet.jit.si iframe approach when admin has set
     * video_provider=daily AND DAILY_API_KEY env vars are configured.
     *
     * Doctor and patient both call this; the response embeds a
     * pre-signed token tying the requester to the room as the right
     * role (doctor=owner, patient=guest).
     */
    public function dailyRoom(Request $request, int $appointmentId)
    {
        $user = $request->user();
        $appt = Appointment::findOrFail($appointmentId);

        // Pool-claim parity with joinToken — doctor entering an
        // unclaimed pool appointment grabs it.
        if (! $appt->doctor_id && $user->role === 'doctor') {
            $appt->doctor_id = $user->id;
            $appt->is_pool   = 0;
            if (! in_array($appt->status, ['in_progress', 'completed'], true)) {
                $appt->status = 'confirmed';
            }
            $appt->save();
        }

        if ($appt->patient_id !== $user->id && $appt->doctor_id !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $joinable = ['pending_payment', 'paid', 'confirmed', 'in_progress'];
        if (! in_array($appt->status, $joinable, true)) {
            return response()->json(['message' => 'Appointment ' . $appt->status . ' — cannot join'], 422);
        }

        $client = DailyClient::fromConfig();
        if (! $client) {
            return response()->json([
                'message' => 'Daily.co not configured. Set DAILY_API_KEY and DAILY_DOMAIN env vars on the backend.',
            ], 503);
        }

        $consult = Consultation::firstOrCreate(
            ['appointment_id' => $appt->id],
            ['room_id'        => 'appt-' . $appt->id]
        );
        // Daily room names: lowercase, hyphenated, ≤ 80 chars
        $roomName = 'hansmed-appt-' . $appt->id;

        $room = $client->getOrCreateRoom($roomName);
        if (! $room) {
            return response()->json(['message' => 'Failed to create video room'], 502);
        }

        $isDoctor = $user->id === $appt->doctor_id;
        $displayName = $isDoctor ? ('Dr. ' . ($user->doctorProfile->full_name ?? 'Practitioner'))
                                 : ($user->patientProfile->nickname ?? 'Patient');
        $token = $client->createMeetingToken($roomName, $displayName, $isDoctor);

        return response()->json([
            'consultation' => $consult,
            'room_url'     => $room['url'] ?? null,
            'room_name'    => $roomName,
            'token'        => $token,
            'role'         => $user->role,
            'is_owner'     => $isDoctor,
        ]);
    }

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

    // Called by doctor after video ends — persist notes + duration + case record + treatments.
    // Walk-in visits use the same endpoint but skip the RTC portion.
    //
    // 'draft' => true means: persist the case data but DON\'T mark the
    // consultation as ended. Used by the 'Save as Draft' button so a
    // doctor can save progress mid-consultation and resume later
    // without the system thinking the consult is over.
    public function finish(Request $request, int $appointmentId)
    {
        $data = $request->validate([
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
            'doctor_notes'     => ['nullable', 'string', 'max:5000'],
            'transcript'       => ['nullable', 'string'],
            'case_record'      => ['nullable', 'array'],
            'treatments'       => ['nullable', 'array'],
            'draft'            => ['nullable', 'boolean'],
        ]);

        $isDraft = (bool) ($data['draft'] ?? false);

        $appt = Appointment::where('doctor_id', $request->user()->id)
            ->findOrFail($appointmentId);

        // Walk-in visits might not have a pre-existing consultation row.
        $consult = Consultation::firstOrCreate(
            ['appointment_id' => $appt->id],
            ['room_id' => 'appt-' . $appt->id]
        );

        $updates = [
            'doctor_notes'     => $data['doctor_notes']     ?? null,
            'transcript'       => $data['transcript']       ?? null,
        ];
        // Only stamp ended_at + duration when it's a real finish, not a
        // mid-consult draft save. Drafts keep the consult open.
        if (! $isDraft) {
            $updates['ended_at']         = now();
            $updates['duration_seconds'] = $data['duration_seconds'] ?? null;
        }
        // The Consultation model casts case_record + treatments as 'array',
        // so Eloquent json_encodes them on save. Passing already-encoded
        // strings here would double-encode and AppointmentController::show's
        // single json_decode would then return a string instead of an
        // object/array, breaking 'Edit in consult' rehydration.
        if (array_key_exists('case_record', $data)) {
            $updates['case_record'] = $data['case_record'];
        }
        if (array_key_exists('treatments', $data)) {
            $updates['treatments'] = $data['treatments'];
        }
        $consult->update($updates);

        return response()->json([
            'consultation' => $consult,
            'draft'        => $isDraft,
        ]);
    }
}
