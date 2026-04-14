<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $table = 'appointments';

    protected $fillable = [
        'patient_id', 'doctor_id', 'scheduled_start', 'scheduled_end',
        'status', 'fee', 'payment_id', 'tongue_diagnosis_id',
        'questionnaire_id', 'notes',
        // Pool-mode fields
        'concern', 'concern_label', 'recommended_specialty', 'is_pool',
    ];

    protected $casts = [
        'scheduled_start' => 'datetime',
        'scheduled_end'   => 'datetime',
        'fee'             => 'decimal:2',
    ];

    public function patient() { return $this->belongsTo(User::class, 'patient_id'); }
    public function doctor()  { return $this->belongsTo(User::class, 'doctor_id'); }
}
