<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TongueDiagnosis extends Model
{
    protected $table = 'tongue_diagnoses';

    protected $fillable = [
        'patient_id', 'image_url', 'thumbnail_url',
        'third_party_request_id', 'status',
        'tongue_color', 'coating', 'shape', 'teeth_marks', 'cracks', 'moisture',
        'raw_response', 'constitution_report', 'health_score',
        // Doctor review
        'review_status', 'doctor_comment', 'reviewed_by', 'reviewed_at',
        'medicine_suggestions',
    ];

    protected $casts = [
        'raw_response'         => 'array',
        'constitution_report'  => 'array',
        'medicine_suggestions' => 'array',
        'teeth_marks'          => 'boolean',
        'cracks'               => 'boolean',
        'reviewed_at'          => 'datetime',
    ];

    public function patient()  { return $this->belongsTo(User::class, 'patient_id'); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
