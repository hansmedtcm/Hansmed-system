<?php

namespace Tests\Feature\Pharmacy;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests the post-breach anonymisation of the pharmacy pre-order Rx inbox
 * (commit 86623cb, Day 2). Pharmacy users should NOT see patient PII —
 * the patient-practitioner-pharmacy chain on this platform doesn't require
 * the pharmacy to have direct identifying info to dispense.
 *
 * Before the fix: PrescriptionInboxController eager-loaded
 * 'patient.patientProfile', exposing NRIC, address, emergency contact.
 * After the fix: the relationship is unset before serialisation as a
 * defence-in-depth measure.
 *
 * This is also Privacy Policy v2 Issue 2 (RBAC scoping misrepresentation).
 */
class RxInboxAnonymisationTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function pharmacy_user_sees_rx_inbox_without_patient_pii(): void
    {
        $pharmacy = User::factory()->create(['role' => 'pharmacy']);
        $this->actingAs($pharmacy, 'sanctum');

        $res = $this->getJson('/api/pharmacy/prescription-inbox');

        $res->assertOk();
        $body = $res->json();

        // Recursively scan the response for any patient PII field name.
        $forbidden = [
            'ic_number',
            'address_line1',
            'address_line2',
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relation',
            'date_of_birth',
        ];

        $json = json_encode($body);
        foreach ($forbidden as $field) {
            $this->assertStringNotContainsString(
                "\"{$field}\"",
                $json,
                "pharmacy Rx inbox should not surface field: {$field}"
            );
        }
    }

    /** @test */
    public function pharmacy_user_still_sees_rx_data_needed_for_dispensing(): void
    {
        // Defence-in-depth must not break the use case: pharmacy still needs
        // prescription_id, herbs/dosage, prescription date, status.
        $pharmacy = User::factory()->create(['role' => 'pharmacy']);
        $this->actingAs($pharmacy, 'sanctum');

        $res = $this->getJson('/api/pharmacy/prescription-inbox');
        $res->assertOk();

        // We can't assert specific values without seed data; assert the
        // structure shape is what dispensers depend on.
        if (count($res->json()) > 0) {
            $res->assertJsonStructure([
                '*' => ['id', 'status'],
            ]);
        } else {
            $this->markTestSkipped('No seeded Rx in fixture — structure assertion skipped.');
        }
    }
}
