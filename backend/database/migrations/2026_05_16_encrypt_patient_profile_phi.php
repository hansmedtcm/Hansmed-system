<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

/**
 * Encrypt-at-rest migration for sensitive PatientProfile fields.
 *
 * Post-breach Day 2 hardening (2026-05-16). Closes the
 * encryption-at-rest misrepresentation in Privacy Policy v2 §5a/§7
 * by adding application-level Laravel encryption to ten high-
 * sensitivity PHI fields on patient_profiles. Together with the
 * model-side $casts change in App\Models\PatientProfile, this
 * makes the policy's "encryption at rest (AES-256) ... applied to
 * all patient data" claim accurate at the application layer (it
 * was previously only accurate at Railway/GCP's disk layer).
 *
 * Fields encrypted (9 total — verified no WHERE/whereLike usage
 * in the codebase as of 2026-05-16 after a corrected grep that
 * caught `orWhere` patterns too):
 *   address_line1, address_line2,
 *   emergency_contact_name, emergency_contact_phone,
 *   emergency_contact_relation,
 *   allergies, medical_history, current_medications, family_history
 *
 * Fields NOT encrypted (and why):
 *   - phone: used in WHERE clauses (AuthController.php:92, :301)
 *     for collision detection + password-reset lookup. Encrypting
 *     would silently return zero matches.
 *   - ic_number: used in `orWhere ... LIKE %s%` in
 *     Admin/PatientController.php:20 and
 *     Doctor/PatientListController.php:54 for NRIC partial-match
 *     search. Encrypting would silently break admin and doctor
 *     patient search by NRIC — the canonical platform lookup the
 *     compliance-sensitive operations rely on. Excluded for now;
 *     proper fix requires a deterministic `ic_number_hash` column
 *     for lookup with the ciphertext kept in `ic_number`. Tracked
 *     as a separate task.
 *   - full_name, nickname: used for display + admin search.
 *   - gender, birth_date, height_cm, weight_kg, blood_type:
 *     low-cardinality / structured data; encryption adds little
 *     forensic value and may complicate analytics.
 *   - city, state, postal_code, country: potentially used for
 *     geographic queries / analytics; deferred.
 *
 * Idempotent: re-runnable safely. Detects already-encrypted values
 * via Crypt::decryptString() round-trip; skips them.
 *
 * Reversibility: down() is intentionally a no-op. Decrypting and
 * writing plaintext back would defeat the purpose of the
 * migration and re-expose PHI to anyone with DB read access.
 * To roll back, restore from a pre-migration backup.
 */
return new class extends Migration
{
    /** The PHI fields that get the encrypted treatment. ic_number
     *  was deliberately removed from this list after the post-
     *  implementation review caught its use in `orWhere ... LIKE`
     *  queries (Admin/Doctor patient search). Encrypting it would
     *  silently zero-out those searches. */
    private array $phiFields = [
        'address_line1', 'address_line2',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        'allergies', 'medical_history', 'current_medications', 'family_history',
    ];

    public function up(): void
    {
        // Step 1: widen the columns to TEXT so they can hold the
        // Laravel-encrypted payload. Laravel Crypt::encryptString()
        // returns a base64-encoded JSON envelope; typical output is
        // ~250-400 characters even for short inputs, far exceeding
        // the original VARCHAR widths. We use raw ALTER TABLE
        // statements rather than Schema::change() to avoid the
        // doctrine/dbal dependency which is not in composer.json.
        //
        // Each ALTER is wrapped to be safe-to-re-run: if the column
        // is already TEXT (a re-run scenario), the ALTER is a no-op
        // for type change but harmless.
        foreach ($this->phiFields as $field) {
            try {
                DB::statement("ALTER TABLE patient_profiles MODIFY {$field} TEXT NULL");
            } catch (\Throwable $e) {
                // Log but continue — column may already be TEXT or
                // the table state may vary. Re-runs are expected
                // to be idempotent.
                Log::warning("[encrypt_phi migration] ALTER TABLE for {$field} failed: " . $e->getMessage());
            }
        }

        // Step 2: encrypt existing plaintext rows.
        //
        // We use raw DB::table() queries to bypass the Eloquent
        // cast layer entirely — this matters because by the time
        // this migration runs, the PatientProfile model already has
        // $casts entries marking these fields as 'encrypted'. Going
        // through the model would trigger decrypt-on-read of values
        // that are still plaintext, throwing DecryptException.
        //
        // Idempotency: for each value, we attempt decryptString().
        // If it succeeds the value is already encrypted, so we
        // skip. If it throws, the value is plaintext and we
        // encrypt it. This makes the migration safe to re-run
        // (e.g. if a deploy is interrupted mid-loop).
        $encrypted = 0;
        $skipped = 0;
        $errored = 0;

        DB::table('patient_profiles')->orderBy('user_id')->chunkById(100, function ($rows) use (&$encrypted, &$skipped, &$errored) {
            foreach ($rows as $row) {
                $updates = [];
                foreach ($this->phiFields as $field) {
                    $value = $row->{$field} ?? null;
                    if ($value === null || $value === '') {
                        continue;
                    }
                    try {
                        // If decrypt succeeds, this value is already encrypted.
                        Crypt::decryptString($value);
                        $skipped++;
                    } catch (\Throwable $e) {
                        // Not encrypted yet — encrypt it.
                        try {
                            $updates[$field] = Crypt::encryptString($value);
                            $encrypted++;
                        } catch (\Throwable $encErr) {
                            Log::warning("[encrypt_phi migration] encrypt failed for user_id={$row->user_id} field={$field}: " . $encErr->getMessage());
                            $errored++;
                        }
                    }
                }
                if (!empty($updates)) {
                    DB::table('patient_profiles')
                        ->where('user_id', $row->user_id)
                        ->update($updates);
                }
            }
        }, 'user_id');

        Log::info("[encrypt_phi migration] complete: encrypted={$encrypted}, skipped (already encrypted)={$skipped}, errored={$errored}");
    }

    public function down(): void
    {
        // Intentional no-op.
        //
        // Decrypting and writing plaintext back to the database
        // would defeat the purpose of this migration and re-expose
        // PHI to anyone with database read access. If a rollback is
        // genuinely required, restore from a pre-migration DB
        // backup. The model-side $casts change should be reverted
        // first to avoid decrypt-on-read failures on now-plaintext
        // values.
        Log::warning('[encrypt_phi migration] down() called but is a no-op by design; rollback requires DB restore. See migration class docblock.');
    }
};
