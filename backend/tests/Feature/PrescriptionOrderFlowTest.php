<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Appointment;
use App\Models\DoctorProfile;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\PatientProfile;
use App\Models\PharmacyProfile;
use App\Models\Prescription;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Day 6 reconciliation (2026-05-18):
 *
 *   1. Patient now gets a PatientProfile with registration_completed=1
 *      so the EnsureRegistrationComplete middleware doesn't 403 on
 *      /patient/orders.
 *
 *   2. medicine_catalog row inserted for 'Astragalus' with sufficient
 *      stock_grams. Without it, DoctorPrescriptionController's stock-
 *      availability gate (PrescriptionController:186-272) returns
 *      422 'not_in_catalog' before the prescription gets issued.
 *
 *   3. Doctor user is created with verification_status='approved' so
 *      the appointment + prescription endpoints accept the doctor.
 */
class PrescriptionOrderFlowTest extends TestCase
{
    public function test_doctor_issues_prescription_then_patient_orders_from_pharmacy(): void
    {
        // users + profiles
        $patient = $this->makePatient('p@o.com');
        $doctor  = $this->makeDoctor('d@o.com');
        $pharm   = $this->makePharmacy('ph@o.com');

        // pharmacy carries the drug as a product
        $product = Product::create([
            'pharmacy_id' => $pharm->id, 'name' => 'Astragalus',
            'unit' => 'g', 'unit_price' => 1.00, 'is_listed' => true,
        ]);
        Inventory::create(['product_id' => $product->id, 'quantity_on_hand' => 1000]);

        // Stock-gate prerequisite: medicine_catalog must have a row matching
        // the drug name with sufficient stock_grams.
        $this->seedMedicineCatalog('AST01', 'Astragalus', 'Huang Qi', 1000);

        // appointment + prescription (by-hand to skip payment flow)
        $appt = Appointment::create([
            'patient_id' => $patient->id, 'doctor_id' => $doctor->id,
            'scheduled_start' => now()->addHour(),
            'scheduled_end'   => now()->addHour()->addMinutes(30),
            'status' => 'completed', 'fee' => 100,
        ]);
        // Use $this->actingAs(..., 'sanctum') rather than Bearer-header
        // tokens so each role context is set explicitly per request.
        // Laravel's test client persists session cookies between
        // requests; Sanctum's stateful middleware prefers session auth
        // over the Bearer header, so once one request authenticates,
        // the NEXT request (with a different role's Bearer token)
        // would still resolve to the prior user via session. That was
        // CI #17's root cause for the patient-orders 403.
        //
        // Using $this->actingAs (Laravel core) instead of
        // Sanctum::actingAs (Sanctum facade) avoids the Mockery dev
        // dependency which isn't in composer.json's require-dev.
        $this->actingAs($doctor, 'sanctum');
        $res = $this->postJson('/api/doctor/prescriptions', [
            'appointment_id' => $appt->id,
            'diagnosis'      => 'Qi deficiency',
            'items' => [
                ['drug_name' => 'Astragalus', 'quantity' => 30, 'unit' => 'g'],
            ],
        ]);
        $res->assertCreated();

        $rxId = $res->json('prescription.id');
        $this->assertSame('issued', Prescription::find($rxId)->status);

        // patient orders the prescription from the pharmacy
        $address = Address::create([
            'user_id' => $patient->id, 'recipient' => 'P', 'phone' => '1',
            'country' => 'MY', 'city' => 'KL', 'line1' => 'x', 'is_default' => true,
        ]);

        $this->actingAs($patient, 'sanctum');
        $order = $this->postJson('/api/patient/orders', [
            'prescription_id' => $rxId,
            'pharmacy_id'     => $pharm->id,
            'address_id'      => $address->id,
        ])->assertCreated()->json('order');

        $this->assertEquals(30.0, $order['subtotal']);
        $this->assertSame('pending_payment', $order['status']);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order['id'], 'drug_name' => 'Astragalus',
        ]);
    }

    public function test_pharmacy_dispensing_decrements_inventory(): void
    {
        $patient = $this->makePatient('p2@o.com');
        $pharm   = $this->makePharmacy('ph2@o.com');

        $product = Product::create([
            'pharmacy_id' => $pharm->id, 'name' => 'Goji', 'unit' => 'g',
            'unit_price' => 1.0, 'is_listed' => true,
        ]);
        Inventory::create(['product_id' => $product->id, 'quantity_on_hand' => 100]);
        $address = Address::create([
            'user_id' => $patient->id, 'recipient' => 'P', 'phone' => '1',
            'country' => 'MY', 'city' => 'KL', 'line1' => 'y',
        ]);

        $order = Order::create([
            'order_no' => 'HMTEST1', 'patient_id' => $patient->id,
            'pharmacy_id' => $pharm->id, 'address_id' => $address->id,
            'status' => 'paid', 'subtotal' => 10, 'total' => 10,
        ]);
        $order->items()->create([
            'product_id' => $product->id, 'drug_name' => 'Goji',
            'unit_price' => 1.0, 'quantity' => 10, 'unit' => 'g', 'line_total' => 10,
        ]);

        $t = $pharm->createToken('api')->plainTextToken;
        $this->withHeader('Authorization', "Bearer {$t}")
            ->postJson("/api/pharmacy/orders/{$order->id}/dispense/start")->assertOk();
        $this->withHeader('Authorization', "Bearer {$t}")
            ->postJson("/api/pharmacy/orders/{$order->id}/dispense/finish")->assertOk();

        $this->assertEquals(90.0, Inventory::where('product_id', $product->id)->value('quantity_on_hand'));
        $this->assertSame('dispensed', Order::find($order->id)->status);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function makePatient(string $email): User
    {
        $user = User::create([
            'email'             => $email,
            'password_hash'     => Hash::make('Password123!'),
            'role'              => 'patient',
            'status'            => 'active',
            'email_verified_at' => now(),
        ]);
        PatientProfile::create([
            'user_id'                => $user->id,
            'registration_completed' => true,
            'nickname'               => 'P',
            'phone'                  => '+60123456789',
        ]);
        return $user;
    }

    private function makeDoctor(string $email): User
    {
        $user = User::create([
            'email'             => $email,
            'password_hash'     => Hash::make('Password123!'),
            'role'              => 'doctor',
            'status'            => 'active',
            'email_verified_at' => now(),
        ]);
        DoctorProfile::create([
            'user_id'                => $user->id,
            'full_name'              => 'Dr. O',
            'verification_status'    => 'approved',
            'accepting_appointments' => true,
            'consultation_fee'       => 100,
        ]);
        return $user;
    }

    private function makePharmacy(string $email): User
    {
        $user = User::create([
            'email'             => $email,
            'password_hash'     => Hash::make('Password123!'),
            'role'              => 'pharmacy',
            'status'            => 'active',
            'email_verified_at' => now(),
        ]);
        PharmacyProfile::create([
            'user_id'             => $user->id,
            'name'                => 'Ph O',
            'verification_status' => 'approved',
        ]);
        return $user;
    }

    /**
     * Insert a medicine_catalog row that the stock-availability gate
     * will recognize. Uses DB::insert because there's no Eloquent model
     * for medicine_catalog in this branch.
     */
    private function seedMedicineCatalog(string $code, string $nameZh, string $pinyin, float $stockGrams): void
    {
        DB::table('medicine_catalog')->insert([
            'code'         => $code,
            'name_zh'      => $nameZh,
            'name_pinyin'  => $pinyin,
            'type'         => 'single',
            'unit'         => 'per 100g',
            'pack_grams'   => 100,
            'unit_price'   => 1.0,
            'stock_grams'  => $stockGrams,
            'reorder_threshold' => 100,
            'source'       => 'test-seed',
            'is_active'    => 1,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);
    }
}
