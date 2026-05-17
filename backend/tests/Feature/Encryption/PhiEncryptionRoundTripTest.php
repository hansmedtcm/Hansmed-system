<?php

namespace Tests\Feature\Encryption;

use App\Models\PatientProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Verifies the PHI encryption-at-rest cast added in commit c21a133.
 *
 * The 9 fields cast as 'encrypted' on PatientProfile must:
 *   1. Write to DB as ciphertext (raw row shows Laravel envelope prefix)
 *   2. Read back as plaintext via the Eloquent attribute
 *   3. Round-trip exactly (no character loss, esp. for non-ASCII content)
 *   4. NOT include ic_number (intentionally excluded — see Task #12 future
 *      ic_number_hash work, and the orWhere-LIKE issue caught by Day 2
 *      code-reviewer agent that prevented this from being added)
 */
class PhiEncryptionRoundTripTest extends TestCase
{
    use RefreshDatabase;

    private const ENCRYPTED_FIELDS = [
        'address_line1',
        'address_line2',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relation',
        'allergies',
        'medical_history',
        'current_medications',
        'family_history',
    ];

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'patient']);
    }

    /** @test */
    public function it_round_trips_plaintext_through_eloquent(): void
    {
        $plaintext = [
            'address_line1'              => '12 Jalan Damai',
            'address_line2'              => 'Taman Indah',
            'emergency_contact_name'     => 'Mrs. Lim',
            'emergency_contact_phone'    => '+60 12-345 6789',
            'emergency_contact_relation' => 'spouse',
            'allergies'                  => 'shellfish; penicillin',
            'medical_history'            => 'hypertension since 2018',
            'current_medications'        => 'amlodipine 5mg daily',
            'family_history'             => 'father — diabetes type 2',
        ];

        $profile = PatientProfile::create(array_merge(
            ['user_id' => $this->user->id],
            $plaintext
        ));

        // Re-fetch from DB to bypass any in-memory caching
        $loaded = PatientProfile::findOrFail($profile->id);

        foreach ($plaintext as $field => $value) {
            $this->assertSame(
                $value,
                $loaded->$field,
                "field {$field} did not round-trip cleanly through Eloquent"
            );
        }
    }

    /** @test */
    public function the_raw_db_value_is_encrypted_not_plaintext(): void
    {
        $known = 'unique-marker-string-202601016057';

        $profile = PatientProfile::create([
            'user_id'         => $this->user->id,
            'allergies'       => $known,
            'medical_history' => $known,
        ]);

        // Bypass the Eloquent cast — go straight to the raw column value
        $raw = DB::table('patient_profiles')->where('id', $profile->id)->first();

        $this->assertStringNotContainsString(
            $known,
            $raw->allergies,
            'raw DB value for allergies still contains plaintext — encryption cast not applied'
        );
        $this->assertStringNotContainsString($known, $raw->medical_history);

        // Crypt::decryptString() should reverse the ciphertext
        $this->assertSame($known, Crypt::decryptString($raw->allergies));
        $this->assertSame($known, Crypt::decryptString($raw->medical_history));
    }

    /** @test */
    public function it_handles_non_ascii_content_without_corruption(): void
    {
        // Patient case notes commonly include Traditional Chinese for TCM
        // diagnoses (寒 / 熱 / 虛 / 實), herb names (麻黃, 桂枝), etc.
        // Encryption must NOT corrupt UTF-8 sequences.
        $cjk = '主訴: 頭痛眩暈, 心悸失眠。診斷: 肝陽上亢, 心腎不交。處方: 天麻鈎藤飲加味。';

        $profile = PatientProfile::create([
            'user_id'         => $this->user->id,
            'medical_history' => $cjk,
        ]);

        $loaded = PatientProfile::findOrFail($profile->id);
        $this->assertSame($cjk, $loaded->medical_history);

        // Sanity: bytes match too
        $this->assertSame(strlen($cjk), strlen($loaded->medical_history));
    }

    /** @test */
    public function ic_number_is_intentionally_NOT_encrypted(): void
    {
        // ic_number was DELIBERATELY excluded from the encryption cast
        // because Admin/PatientController and Doctor/PatientListController
        // use orWhere('ic_number', 'like', ...) in their search code paths.
        // Encrypting it would silently break search — caught by Day 2
        // code-reviewer agent. See Task #12 for the future ic_number_hash
        // approach that lets us encrypt and still search.
        $profile = PatientProfile::create([
            'user_id'   => $this->user->id,
            'ic_number' => '900101-08-1234',
        ]);

        $raw = DB::table('patient_profiles')->where('id', $profile->id)->first();

        $this->assertSame(
            '900101-08-1234',
            $raw->ic_number,
            'ic_number must remain in plaintext until ic_number_hash exists (Task #12)'
        );
    }
}
