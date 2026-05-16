<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PatientProfile extends Model
{
    protected $table = 'patient_profiles';
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = [
        'user_id', 'registration_completed',
        'nickname', 'full_name', 'avatar_url', 'gender', 'birth_date',
        'phone', 'ic_number', 'occupation',
        'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        'blood_type', 'allergies', 'medical_history', 'current_medications',
        'family_history', 'height_cm', 'weight_kg',
    ];

    protected $casts = [
        'birth_date'             => 'date',
        'height_cm'              => 'decimal:2',
        'weight_kg'              => 'decimal:2',
        'registration_completed' => 'boolean',

        // ── Application-level encryption-at-rest for sensitive PHI ──
        //
        // Added 2026-05-16 (post-breach Day 2 hardening) to make the
        // Privacy Policy v2 §5a/§7 "encryption at rest (AES-256)
        // applied to all patient data" claim accurate at the
        // application layer (it was previously only accurate at the
        // Railway/GCP disk layer).
        //
        // The migration 2026_05_16_encrypt_patient_profile_phi.php
        // widens these columns to TEXT and encrypts existing rows.
        // Once that migration has run, every read returns the
        // decrypted plaintext (via this cast) and every write
        // encrypts (also via this cast).
        //
        // FIELDS NOT INCLUDED HERE (and why):
        //   - phone: used in WHERE clauses (AuthController.php:92, :301
        //     for collision detection + lookup). Encrypting would break
        //     those queries silently. Future work: phone_hash column for
        //     deterministic lookup + encrypted phone itself.
        //   - ic_number: used in `orWhere ... LIKE %s%` clauses for
        //     Admin/PatientController and Doctor/PatientListController
        //     NRIC partial-match search. Encrypting would silently
        //     break that search. Tracked as a separate task: add an
        //     `ic_number_hash` column with deterministic hash for
        //     lookup + encrypt the canonical `ic_number` value.
        //   - full_name, nickname: used for display and admin search.
        //   - gender, birth_date, height_cm, weight_kg, blood_type:
        //     low-cardinality / structured data; encryption adds little
        //     forensic value and may complicate analytics.
        //   - city, state, postal_code, country: potentially needed for
        //     geographic queries / analytics; deferred.
        'address_line1'              => 'encrypted',
        'address_line2'              => 'encrypted',
        'emergency_contact_name'     => 'encrypted',
        'emergency_contact_phone'    => 'encrypted',
        'emergency_contact_relation' => 'encrypted',
        'allergies'                  => 'encrypted',
        'medical_history'            => 'encrypted',
        'current_medications'        => 'encrypted',
        'family_history'             => 'encrypted',
    ];

    /**
     * Sensitive PII never returned in API responses by default.
     *
     * Brief #20 — privacy hardening for doctor-side endpoints. The
     * doctor-patient relationship is mediated by the platform; doctors
     * should NOT see direct contact info (phone, postal address,
     * emergency contact details). They communicate with patients via
     * platform messaging + video and never need to call/visit them
     * directly.
     *
     * Hidden by default:
     *   • ic_number — Malaysian NRIC, primary identity-theft vector
     *   • phone, address_*, country — direct contact info
     *   • emergency_contact_* — the emergency contact's PII (a
     *     SECOND data subject's PDPA rights)
     *
     * Visible contexts (must call ->makeVisible([...])):
     *   • Patient viewing OWN profile (Patient/ProfileController)
     *   • Patient exporting OWN data (Patient/DataExportController)
     *   • Admin viewing patient detail (Admin/PatientController etc.)
     *
     * Doctor and pharmacy contexts inherit the default hidden state —
     * these fields don't leak into JSON responses.
     *
     * Note on email (on User model, not here): doctor controllers
     * additionally constrain the User selection via
     * ->with(['patient' => fn($q) => $q->select('id', 'role'), ...])
     * to keep email out of doctor-side responses.
     */
    protected $hidden = [
        'ic_number',
        'phone',
        'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
    ];

    public function user() { return $this->belongsTo(User::class, 'user_id'); }

    /**
     * Brief #20 — opt back into showing all the contact-info fields
     * we hide by default (phone, address, emergency contact, IC).
     * Call this in controllers where the requesting party is allowed
     * to see them: the patient looking at their own profile, or
     * admins reviewing patient detail.
     *
     * Doctor controllers MUST NOT call this — it would leak the
     * exact contact data we just hid.
     *
     *   $user->patientProfile->revealContactInfo();
     */
    public function revealContactInfo(): self
    {
        return $this->makeVisible([
            'ic_number',
            'phone',
            'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        ]);
    }
}
