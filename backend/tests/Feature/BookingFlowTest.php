<?php

namespace Tests\Feature;

use App\Models\DoctorProfile;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BookingFlowTest extends TestCase
{
    private function makeDoctor(): User
    {
        $doc = User::create([
            'email' => 'doc@t.com', 'password_hash' => Hash::make('password123'),
            'role' => 'doctor', 'status' => 'active',
        ]);
        DoctorProfile::create([
            'user_id' => $doc->id, 'full_name' => 'Dr. D',
            'verification_status' => 'approved',
            'accepting_appointments' => true,
            'consultation_fee' => 150,
        ]);
        return $doc;
    }

    public function test_patient_can_book_appointment_and_gets_payment_intent(): void
    {
        $doctor = $this->makeDoctor();
        $patient = User::create([
            'email' => 'p@t.com', 'password_hash' => Hash::make('password123'),
            'role' => 'patient', 'status' => 'active',
        ]);
        $token = $patient->createToken('api')->plainTextToken;

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
        $doctor = $this->makeDoctor();
        $patient = User::create([
            'email' => 'p2@t.com', 'password_hash' => Hash::make('password123'),
            'role' => 'patient', 'status' => 'active',
        ]);
        $token = $patient->createToken('api')->plainTextToken;

        $start = now()->addDay()->setTime(10, 0);
        $end   = $start->copy()->addMinutes(30);

        $payload = [
            'doctor_id'       => $doctor->id,
            'scheduled_start' => $start->toIso8601String(),
            'scheduled_end'   => $end->toIso8601String(),
        ];

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/patient/appointments', $payload)
            ->assertCreated();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/patient/appointments', $payload)
            ->assertStatus(422);
    }
}
