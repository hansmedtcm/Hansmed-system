<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PatientProfile extends Model
{
    protected $table = 'patient_profiles';
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = [
        'user_id', 'nickname', 'full_name', 'avatar_url', 'gender', 'birth_date',
        'phone', 'ic_number', 'occupation',
        'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        'blood_type', 'allergies', 'medical_history', 'current_medications',
        'family_history', 'height_cm', 'weight_kg',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'height_cm'  => 'decimal:2',
        'weight_kg'  => 'decimal:2',
    ];

    public function user() { return $this->belongsTo(User::class, 'user_id'); }
}
