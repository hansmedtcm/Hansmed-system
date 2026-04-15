<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Consultation extends Model
{
    protected $table = 'consultations';
    public $timestamps = false;

    protected $fillable = [
        'appointment_id', 'room_id', 'started_at', 'ended_at',
        'duration_seconds', 'transcript', 'doctor_notes',
        // Walk-in / in-person support
        'case_record', 'treatments',
    ];

    protected $casts = [
        'started_at'  => 'datetime',
        'ended_at'    => 'datetime',
        'case_record' => 'array',
        'treatments'  => 'array',
    ];
}
