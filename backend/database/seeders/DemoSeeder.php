<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\DoctorProfile;
use App\Models\Inventory;
use App\Models\PatientProfile;
use App\Models\PharmacyProfile;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // ---- admin ---------------------------------------------------
        $admin = User::updateOrCreate(
            ['email' => 'admin@hansmed.test'],
            [
                'password_hash' => Hash::make('password'),
                'role'          => 'admin',
                'status'        => 'active',
            ],
        );

        // ---- patient -------------------------------------------------
        $patient = User::updateOrCreate(
            ['email' => 'patient@hansmed.test'],
            [
                'password_hash' => Hash::make('password'),
                'role'          => 'patient',
                'status'        => 'active',
            ],
        );
        PatientProfile::updateOrCreate(
            ['user_id' => $patient->id],
            [
                'nickname'   => 'Alice',
                'gender'     => 'female',
                'birth_date' => '1992-05-14',
                'phone'      => '+61400000001',
                'height_cm'  => 165,
                'weight_kg'  => 58,
            ],
        );
        Address::updateOrCreate(
            ['user_id' => $patient->id, 'line1' => '12 Test Street'],
            [
                'recipient'  => 'Alice',
                'phone'      => '+61400000001',
                'country'    => 'Australia',
                'state'      => 'VIC',
                'city'       => 'Melbourne',
                'line1'      => '12 Test Street',
                'postal_code'=> '3000',
                'is_default' => true,
            ],
        );

        // ---- doctor --------------------------------------------------
        $doctor = User::updateOrCreate(
            ['email' => 'doctor@hansmed.test'],
            [
                'password_hash' => Hash::make('password'),
                'role'          => 'doctor',
                'status'        => 'active',
            ],
        );
        DoctorProfile::updateOrCreate(
            ['user_id' => $doctor->id],
            [
                'full_name'             => 'Dr. Chen Wei',
                'bio'                   => 'TCM practitioner, 15 years experience, specialty in internal medicine and constitution regulation.',
                'specialties'           => 'Internal medicine, Gynecology',
                'license_no'            => 'TCM-2024-001',
                'verification_status'   => 'approved',
                'rating'                => 4.8,
                'consultation_count'    => 532,
                'consultation_fee'      => 120.00,
                'accepting_appointments'=> true,
            ],
        );

        // ---- pharmacy ------------------------------------------------
        $pharm = User::updateOrCreate(
            ['email' => 'pharmacy@hansmed.test'],
            [
                'password_hash' => Hash::make('password'),
                'role'          => 'pharmacy',
                'status'        => 'active',
            ],
        );
        PharmacyProfile::updateOrCreate(
            ['user_id' => $pharm->id],
            [
                'name'                => 'Harmony TCM Pharmacy',
                'license_no'          => 'PHARM-0001',
                'verification_status' => 'approved',
                'address_line'        => '88 Herb Lane',
                'city'                => 'Melbourne',
                'state'               => 'VIC',
                'country'             => 'Australia',
                'postal_code'         => '3000',
                'latitude'            => -37.8136,
                'longitude'           => 144.9631,
                'delivery_radius_km'  => 30,
                'business_hours'      => 'Mon-Sat 9:00-18:00',
                'phone'               => '+61399999999',
            ],
        );

        // ---- products ------------------------------------------------
        $products = [
            ['name' => '黄芪 (Astragalus)',   'unit' => 'g', 'unit_price' => 0.80,  'stock' => 5000],
            ['name' => '当归 (Angelica)',      'unit' => 'g', 'unit_price' => 1.20,  'stock' => 3000],
            ['name' => '枸杞 (Goji berry)',    'unit' => 'g', 'unit_price' => 0.60,  'stock' => 8000],
            ['name' => '白术 (Atractylodes)',  'unit' => 'g', 'unit_price' => 0.90,  'stock' => 2500],
            ['name' => '茯苓 (Poria)',         'unit' => 'g', 'unit_price' => 0.70,  'stock' => 4000],
            ['name' => '甘草 (Licorice root)', 'unit' => 'g', 'unit_price' => 0.50,  'stock' => 6000],
        ];
        foreach ($products as $p) {
            $product = Product::updateOrCreate(
                ['pharmacy_id' => $pharm->id, 'name' => $p['name']],
                [
                    'specification' => 'dried, bulk',
                    'unit'          => $p['unit'],
                    'unit_price'    => $p['unit_price'],
                    'is_listed'     => true,
                ],
            );
            Inventory::updateOrCreate(
                ['product_id' => $product->id],
                ['quantity_on_hand' => $p['stock'], 'reorder_threshold' => 500],
            );
        }

        $this->command?->info('Demo accounts created (password: password):');
        $this->command?->info('  admin@hansmed.test');
        $this->command?->info('  patient@hansmed.test');
        $this->command?->info('  doctor@hansmed.test');
        $this->command?->info('  pharmacy@hansmed.test');
    }
}
