<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Appointment;
use App\Models\DoctorProfile;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\PharmacyProfile;
use App\Models\Prescription;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PrescriptionOrderFlowTest extends TestCase
{
    public function test_doctor_issues_prescription_then_patient_orders_from_pharmacy(): void
    {
        // users
        $patient = $this->makeUser('patient', 'p@o.com');
        $doctor  = $this->makeUser('doctor',  'd@o.com');
        DoctorProfile::create([
            'user_id' => $doctor->id, 'full_name' => 'Dr O',
            'verification_status' => 'approved', 'accepting_appointments' => true,
            'consultation_fee' => 100,
        ]);
        $pharm = $this->makeUser('pharmacy', 'ph@o.com');
        PharmacyProfile::create([
            'user_id' => $pharm->id, 'name' => 'Ph O',
            'verification_status' => 'approved',
        ]);

        // pharmacy carries the drug
        $product = Product::create([
            'pharmacy_id' => $pharm->id, 'name' => 'Astragalus',
            'unit' => 'g', 'unit_price' => 1.00, 'is_listed' => true,
        ]);
        Inventory::create(['product_id' => $product->id, 'quantity_on_hand' => 1000]);

        // appointment + prescription (by-hand to skip payment)
        $appt = Appointment::create([
            'patient_id' => $patient->id, 'doctor_id' => $doctor->id,
            'scheduled_start' => now()->addHour(), 'scheduled_end' => now()->addHour()->addMinutes(30),
            'status' => 'completed', 'fee' => 100,
        ]);
        $doctorToken = $doctor->createToken('api')->plainTextToken;

        $res = $this->withHeader('Authorization', "Bearer {$doctorToken}")
            ->postJson('/api/doctor/prescriptions', [
                'appointment_id' => $appt->id,
                'diagnosis'      => 'Qi deficiency',
                'items' => [
                    ['drug_name' => 'Astragalus', 'quantity' => 30, 'unit' => 'g'],
                ],
            ])->assertCreated();

        $rxId = $res->json('prescription.id');
        $this->assertSame('issued', Prescription::find($rxId)->status);

        // patient orders
        $address = Address::create([
            'user_id' => $patient->id, 'recipient' => 'P', 'phone' => '1',
            'country' => 'AU', 'city' => 'Melb', 'line1' => 'x', 'is_default' => true,
        ]);
        $patientToken = $patient->createToken('api')->plainTextToken;

        $order = $this->withHeader('Authorization', "Bearer {$patientToken}")
            ->postJson('/api/patient/orders', [
                'prescription_id' => $rxId,
                'pharmacy_id'     => $pharm->id,
                'address_id'      => $address->id,
            ])->assertCreated()->json('order');

        $this->assertEquals(30.0, $order['subtotal']);
        $this->assertSame('pending_payment', $order['status']);
        $this->assertDatabaseHas('order_items', ['order_id' => $order['id'], 'drug_name' => 'Astragalus']);
    }

    public function test_pharmacy_dispensing_decrements_inventory(): void
    {
        $patient = $this->makeUser('patient', 'p2@o.com');
        $pharm   = $this->makeUser('pharmacy', 'ph2@o.com');
        PharmacyProfile::create(['user_id' => $pharm->id, 'name' => 'X', 'verification_status' => 'approved']);
        $product = Product::create([
            'pharmacy_id' => $pharm->id, 'name' => 'Goji', 'unit' => 'g',
            'unit_price' => 1.0, 'is_listed' => true,
        ]);
        Inventory::create(['product_id' => $product->id, 'quantity_on_hand' => 100]);
        $address = Address::create([
            'user_id' => $patient->id, 'recipient' => 'P', 'phone' => '1',
            'country' => 'AU', 'city' => 'x', 'line1' => 'y',
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

    private function makeUser(string $role, string $email): User
    {
        return User::create([
            'email' => $email, 'password_hash' => Hash::make('password123'),
            'role' => $role, 'status' => 'active',
        ]);
    }
}
