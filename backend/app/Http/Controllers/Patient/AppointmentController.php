<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Services\StripeClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AppointmentController extends Controller
{
    public function __construct(private StripeClient $stripe) {}

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
        return response()->json(
            Appointment::where('patient_id', $request->user()->id)
                ->orderByDesc('scheduled_start')
                ->paginate(20)
        );
    }

    public function cancel(Request $request, int $id)
    {
        $appt = Appointment::where('patient_id', $request->user()->id)->findOrFail($id);
        if (! in_array($appt->status, ['pending_payment', 'confirmed'], true)) {
            return response()->json(['message' => 'Cannot cancel in current state.'], 422);
        }
        $appt->update(['status' => 'cancelled']);
        return response()->json(['appointment' => $appt]);
    }
}
