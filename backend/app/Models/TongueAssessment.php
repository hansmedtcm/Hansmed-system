<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * TongueAssessment — patient-uploaded tongue photo + AI analysis +
 * licensed practitioner review.
 *
 * Renamed from TongueDiagnosis on 2026-04-25 — see
 * BACKEND_RENAME_TODO.md. The word "diagnosis" was removed from
 * patient-facing surfaces because under MDA 2012 only a registered
 * practitioner makes a diagnosis; the AI tool produces a wellness
 * assessment that a practitioner reviews.
 */
class TongueAssessment extends Model
{
    protected $table = 'tongue_assessments';

    protected $fillable = [
        'patient_id', 'image_url', 'thumbnail_url',
        'third_party_request_id', 'status',
        'tongue_color', 'coating', 'shape', 'teeth_marks', 'cracks', 'moisture',
        'raw_response', 'constitution_report', 'health_score',
        // Practitioner review
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

/*
 * Class alias so any code that still imports the old class name
 * (e.g. external scripts, deferred queue jobs serialized before this
 * deploy) keeps working until they're flushed. Safe to remove after
 * one release cycle.
 */
class_alias(TongueAssessment::class, 'App\\Models\\TongueDiagnosis');
