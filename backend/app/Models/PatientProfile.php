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
        'family_history', 'height_cm', 'weight_kg',,
        // Brief #22 — health baseline for pre-assessment (Hybrid 1C).
        'chronic_conditions', 'halal_only',
        'pregnancy_status', 'pregnancy_status_updated_at',
    ];

    protected $casts = [
        'birth_date'             => 'date',
        'height_cm'              => 'decimal:2',
        'weight_kg'              => 'decimal:2',
        'registration_completed' => 'boolean',
        // Brief #22 — JSON-typed health baseline.
        'chronic_conditions'          => 'array',
        'current_medications'         => 'array',
        'halal_only'                  => 'boolean',
        'pregnancy_status_updated_at' => 'datetime',
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
