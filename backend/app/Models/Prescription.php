<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Prescription extends Model
{
    protected $table = 'prescriptions';

    protected $fillable = [
        'appointment_id', 'doctor_id', 'patient_id', 'status',
        'diagnosis', 'instructions', 'contraindications',
        'duration_days', 'parent_id', 'issued_at',
    ];

    protected $casts = ['issued_at' => 'datetime'];

    public function items()    { return $this->hasMany(PrescriptionItem::class); }
    public function doctor()   { return $this->belongsTo(User::class, 'doctor_id'); }
    public function patient()  { return $this->belongsTo(User::class, 'patient_id'); }
    public function parent()   { return $this->belongsTo(self::class, 'parent_id'); }
}
