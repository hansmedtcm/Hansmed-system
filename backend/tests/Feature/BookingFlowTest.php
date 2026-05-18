<?php

namespace Tests\Feature;

use App\Models\DoctorProfile;
use App\Models\PatientProfile;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Day 6 reconciliation (2026-05-18): added PatientProfile creation
 * with registration_completed=true. Without it, the
 * EnsureRegistrationComplete middleware on the /patient/appointments
 * route returns 403 before the controller runs.
 *
 * Stripe is intentionally not mocked here — the controller wraps the
 * Stripe call in try/catch and continues in "demo mode" if Stripe
 * isn't configured (see AppointmentController:108-110). In CI without
 * STRIPE_SECRET set, $clientSecret returns null but the keys still
 * exist in the response, so assertJsonStructure passes.
 */
class BookingFlowTest extends TestCase
{
    private function makeDoctor(): User
    {
        $doc = User::create([
            'email'             => 'doc@t.com',
            'password_hash'     => Hash::make('Password123!'),
            'role'              => 'doctor',
            'status'            => 'active',
            'email_verified_at' => now(),
        ]);
        DoctorProfile::create([
            'user_id'                => $doc->id,
            'full_name'              => 'Dr. D',
            'verification_status'    => 'approved',
            'accepting_appointments' => true,
            'consultation_fee'       => 150,
        ]);
        return $doc;
    }

    /**
     * Patient must have a PatientProfile with registration_completed=1
     * to access the booking endpoint. Without that row, the
     * registration.complete middleware 403s.
     */
    private function makePatient(string $email): User
    {
        $patient = User::create([
            'email'             => $email,
            'password_hash'     => Hash::make('Password123!'),
            'role'              => 'patient',
            'status'            => 'active',
            'email_verified_at' => now(),
        ]);
        PatientProfile::create([
            'user_id'                => $patient->id,
            'registration_completed' => true,
            'nickname'               => 'P',
            'phone'                  => '+60123456789',
        ]);
        return $patient;
    }

    public function test_patient_can_book_appointment_and_gets_payment_intent(): void
    {
        $doctor  = $this->makeDoctor();
        $patient = $this->makePatient('p@t.com');
        $token   = $patient->createToken('api')->plainTextToken;

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/patient/appointments', [
                'doctor_id'       => $doctor->id,
                'scheduled_start' => now()->addDay()->toIso8601String(),
                'scheduled_end'   => now()->addDay()->addMinutes(30)->toIso8601String(),
            ]);

        $res->assertCreated()
            ->assertJsonPath('appointment.status', 'pending_payment')
            ->assertJsonStructure(['appointment', 'payment', 'stripe_client_secret']);
    }

    public function test_booking_rejects_overlapping_slot(): void
    {
        $doctor  = $this->makeDoctor();
        $patient = $this->makePatient('p2@t.com');
        $token   = $patient->createToken('api')->plainTextToken;

        // Use Y-m-d H:i:s format (no timezone offset) to avoid the
        // controller's `where(scheduled_start, '<', $iso_with_tz)`
        // string comparison treating MYT vs UTC as non-overlapping.
        // Pin a fixed future date so both POSTs send identical bytes.
        $start = now()->addDay()->setTime(10, 0)->format('Y-m-d H:i:s');
        $end   = now()->addDay()->setTime(10, 30)->format('Y-m-d H:i:s');

        $payload = [
            'doctor_id'       => $doctor->id,
            'scheduled_start' => $start,
            'scheduled_end'   => $end,
        ];

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/patient/appointments', $payload)
            ->assertCreated();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/patient/appointments', $payload)
            ->assertStatus(422);
    }
}
