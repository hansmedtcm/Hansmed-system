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

    // C-10: book appointment + create Stripe PaymentIntent
    public function store(Request $request)
    {
        $data = $request->validate([
            'doctor_id'       => ['required', 'integer', 'exists:users,id'],
            'scheduled_start' => ['required', 'date', 'after:now'],
            'scheduled_end'   => ['required', 'date', 'after:scheduled_start'],
            'tongue_diagnosis_id' => ['nullable', 'integer'],
            'questionnaire_id'    => ['nullable', 'integer'],
            'notes'               => ['nullable', 'string', 'max:1000'],
        ]);

        $doctor = DoctorProfile::where('user_id', $data['doctor_id'])
            ->where('verification_status', 'approved')
            ->where('accepting_appointments', true)
            ->first();

        if (! $doctor) {
            throw ValidationException::withMessages(['doctor_id' => 'Doctor not available.']);
        }

        return DB::transaction(function () use ($request, $data, $doctor) {
            // prevent double-booking
            $conflict = Appointment::where('doctor_id', $doctor->user_id)
                ->whereNotIn('status', ['cancelled', 'no_show'])
                ->where('scheduled_start', '<', $data['scheduled_end'])
                ->where('scheduled_end',   '>', $data['scheduled_start'])
                ->exists();
            if ($conflict) {
                throw ValidationException::withMessages(['scheduled_start' => 'Time slot unavailable.']);
            }

            $appt = Appointment::create([
                'patient_id'          => $request->user()->id,
                'doctor_id'           => $doctor->user_id,
                'scheduled_start'     => $data['scheduled_start'],
                'scheduled_end'       => $data['scheduled_end'],
                'status'              => 'pending_payment',
                'fee'                 => $doctor->consultation_fee,
                'tongue_diagnosis_id' => $data['tongue_diagnosis_id'] ?? null,
                'questionnaire_id'    => $data['questionnaire_id']    ?? null,
                'notes'               => $data['notes']               ?? null,
            ]);

            $intent = $this->stripe->createPaymentIntent(
                amountMinor: (int) round($doctor->consultation_fee * 100),
                currency: 'cny',
                metadata: ['appointment_id' => $appt->id, 'patient_id' => $request->user()->id],
            );

            $payment = Payment::create([
                'user_id'      => $request->user()->id,
                'payable_type' => 'appointment',
                'payable_id'   => $appt->id,
                'provider'     => 'stripe',
                'provider_ref' => $intent['id'] ?? null,
                'amount'       => $doctor->consultation_fee,
                'currency'     => 'CNY',
                'status'       => 'pending',
                'raw_payload'  => $intent,
            ]);

            $appt->payment_id = $payment->id;
            $appt->save();

            return response()->json([
                'appointment'         => $appt,
                'payment'             => $payment,
                'stripe_client_secret' => $intent['client_secret'] ?? null,
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
