<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $table = 'appointments';

    protected $fillable = [
        'patient_id', 'doctor_id', 'scheduled_start', 'scheduled_end',
        'status', 'fee', 'payment_id', 'tongue_assessment_id',
        'questionnaire_id', 'notes',
        // Pool-mode fields
        'concern', 'concern_label', 'recommended_specialty', 'is_pool',
        // Walk-in support
        'visit_type',
        // External video meeting URL (Google Meet etc., when video_provider != jitsi)
        'meeting_url',
    ];

    protected $casts = [
        'scheduled_start' => 'datetime',
        'scheduled_end'   => 'datetime',
        'fee'             => 'decimal:2',
    ];

    public function patient() { return $this->belongsTo(User::class, 'patient_id'); }
    public function doctor()  { return $this->belongsTo(User::class, 'doctor_id'); }
    public function prescription() { return $this->hasOne(Prescription::class, 'appointment_id'); }
    public function consultation() { return $this->hasOne(Consultation::class, 'appointment_id'); }
}
