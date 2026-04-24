<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DoctorProfile extends Model
{
    protected $table = 'doctor_profiles';
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = [
        'user_id', 'full_name', 'avatar_url', 'bio', 'specialties',
        'license_no', 'license_doc_url', 'verification_status',
        'tcm_council_no', 'tcm_council_verified_at', 'tcm_council_verified_by',
        'rating', 'consultation_count', 'consultation_fee',
        'accepting_appointments',
    ];

    protected $casts = [
        'rating'                 => 'decimal:2',
        'consultation_fee'       => 'decimal:2',
        'accepting_appointments' => 'boolean',
        'tcm_council_verified_at' => 'datetime',
    ];

    public function user() { return $this->belongsTo(User::class, 'user_id'); }
}
