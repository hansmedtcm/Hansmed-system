<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Services\NotificationService;
use App\Services\StripeClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AppointmentController extends Controller
{
    public function __construct(
        private StripeClient $stripe,
        private NotificationService $notifier,
    ) {}

    // C-10: book appointment + create Stripe PaymentIntent.
    // Now supports POOL bookings: when doctor_id is missing, the appointment
    // enters the pool and any matching doctor can pick it up.
    public function store(Request $request)
    {
        $data = $request->validate([
            'doctor_id'       => ['nullable', 'integer', 'exists:users,id'],
            'scheduled_start' => ['required', 'date'],
            'scheduled_end'   => ['required', 'date', 'after:scheduled_start'],
            'tongue_diagnosis_id' => ['nullable', 'integer'],
            'questionnaire_id'    => ['nullable', 'integer'],
            'notes'               => ['nullable', 'string', 'max:2000'],
            // Pool booking fields
            'concern'              => ['nullable', 'string', 'max:60'],
            'concern_label'        => ['nullable', 'string', 'max:120'],
            'recommended_specialty'=> ['nullable', 'string', 'max:120'],
            'pool'                 => ['nullable', 'boolean'],
            'fee'                  => ['nullable', 'numeric', 'min:0'],
        ]);

        $isPool = empty($data['doctor_id']);

        if (! $isPool) {
            $doctor = DoctorProfile::where('user_id', $data['doctor_id'])
                ->where('verification_status', 'approved')
                ->where('accepting_appointments', true)
                ->first();
            if (! $doctor) {
                throw ValidationException::withMessages(['doctor_id' => 'Doctor not available.']);
            }
        }

        $fee = $isPool ? ($data['fee'] ?? 120) : $doctor->consultation_fee;

        return DB::transaction(function () use ($request, $data, $isPool, $fee) {
            if (! $isPool) {
                // prevent double-booking for named doctor
                $conflict = Appointment::where('doctor_id', $data['doctor_id'])
                    ->whereNotIn('status', ['cancelled', 'no_show'])
                    ->where('scheduled_start', '<', $data['scheduled_end'])
                    ->where('scheduled_end',   '>', $data['scheduled_start'])
                    ->exists();
                if ($conflict) {
                    throw ValidationException::withMessages(['scheduled_start' => 'Time slot unavailable.']);
                }
            }

            $appt = Appointment::create([
                'patient_id'          => $request->user()->id,
                'doctor_id'           => $isPool ? null : $data['doctor_id'],
                'scheduled_start'     => $data['scheduled_start'],
                'scheduled_end'       => $data['scheduled_end'],
                // Pool appointments go straight to 'confirmed' so any doctor can pick them.
                'status'              => $isPool ? 'confirmed' : 'pending_payment',
                'fee'                 => $fee,
                'tongue_diagnosis_id' => $data['tongue_diagnosis_id'] ?? null,
                'questionnaire_id'    => $data['questionnaire_id']    ?? null,
                'notes'               => $data['notes']               ?? null,
                'concern'              => $data['concern']              ?? null,
                'concern_label'        => $data['concern_label']        ?? null,
                'recommended_specialty'=> $data['recommended_specialty']?? null,
                'is_pool'              => $isPool ? 1 : 0,
            ]);

            $clientSecret = null;
            $payment = null;
            try {
                $intent = $this->stripe->createPaymentIntent(
                    amountMinor: (int) round($fee * 100),
                    currency: 'myr',
                    metadata: ['appointment_id' => $appt->id, 'patient_id' => $request->user()->id],
                );
                $payment = Payment::create([
                    'user_id'      => $request->user()->id,
                    'payable_type' => 'appointment',
                    'payable_id'   => $appt->id,
                    'provider'     => 'stripe',
                    'provider_ref' => $intent['id'] ?? null,
                    'amount'       => $fee,
                    'currency'     => 'MYR',
                    'status'       => 'pending',
                    'raw_payload'  => $intent,
                ]);
                $appt->payment_id = $payment->id;
                $appt->save();
                $clientSecret = $intent['client_secret'] ?? null;
            } catch (\Throwable $e) {
                // Stripe not configured — continue in demo mode. Appointment is still created.
            }

            // Notify: named-doctor bookings → that doctor; pool bookings
            // → fan out to every approved+accepting doctor so the first
            // available one picks it up. The audible cue + toast on the
            // doctor portal comes from this notification.
            try {
                if ($isPool) {
                    $this->notifier->appointmentPoolCreated(
                        patientId: $request->user()->id,
                        appointmentId: $appt->id,
                        concernLabel: $data['concern_label'] ?? null,
                        specialty: $data['recommended_specialty'] ?? null,
                    );
                } else {
                    $this->notifier->appointmentConfirmed(
                        patientId: $request->user()->id,
                        doctorId:  $data['doctor_id'],
                        appointmentId: $appt->id,
                    );
                }
            } catch (\Throwable $e) { /* never fail booking on notify glitch */ }

            return response()->json([
                'appointment'          => $appt,
                'payment'              => $payment,
                'stripe_client_secret' => $clientSecret,
                'pool'                 => $isPool,
            ], 201);
        });
    }

    public function index(Request $request)
    {
        // Eager-load the doctor's profile so the patient UI can show
        // the doctor's real name once a pool appointment is picked up.
        // Until then doctor_id is null and the UI shows "Awaiting pickup".
        return response()->json(
            Appointment::where('patient_id', $request->user()->id)
                ->with(['doctor.doctorProfile'])
                ->orderByDesc('scheduled_start')
                ->paginate(20)
        );
    }

    /**
     * Patient self-cancel. Two guards:
     *   1. Status must be pending_payment or confirmed (already-started /
     *      completed / cancelled bookings can't be cancelled again).
     *   2. The appointment must be at least 60 minutes away. Inside the
     *      1-hour window the clinic is already committed — cancel has to
     *      happen through WhatsApp / phone so the doctor can be notified.
     *
     * Walk-in visits (visit_type = walk_in) are exempt from the time gate
     * since the patient hasn't physically arrived yet.
     */
    public function cancel(Request $request, int $id)
    {
        $appt = Appointment::where('patient_id', $request->user()->id)->findOrFail($id);

        if (! in_array($appt->status, ['pending_payment', 'confirmed'], true)) {
            return response()->json(['message' => 'Cannot cancel in current state.'], 422);
        }

        if (($appt->visit_type ?? 'online') !== 'walk_in') {
            $start = $appt->scheduled_start;
            if ($start) {
                $now = now();
                $minutesUntil = $now->diffInMinutes($start, false); // signed
                if ($minutesUntil < 60) {
                    return response()->json([
                        'message' => 'Cannot cancel within 1 hour of the appointment. Please contact the clinic via WhatsApp if you need to cancel.',
                        'message_zh' => '預約前一小時內無法自行取消，請透過 WhatsApp 聯絡診所。',
                        'minutes_until_start' => (int) $minutesUntil,
                    ], 422);
                }
            }
        }

        $appt->update(['status' => 'cancelled']);
        return response()->json(['appointment' => $appt]);
    }
}
