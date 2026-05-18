<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * TongueAssessment - patient-uploaded tongue photo + AI analysis +
 * licensed practitioner review. Renamed from TongueDiagnosis on
 * 2026-04-25 - the word "diagnosis" was removed from patient-facing
 * surfaces because under MDA 2012 only a registered practitioner
 * makes a diagnosis.
 */
class TongueAssessment extends Model
{
    use SoftDeletes;

    protected $table = 'tongue_assessments';

    protected $fillable = [
        'patient_id', 'image_url', 'thumbnail_url',
        'third_party_request_id', 'status',
        'tongue_color', 'coating', 'shape', 'teeth_marks', 'cracks', 'moisture',
        'raw_response', 'constitution_report', 'health_score',
        'review_status', 'doctor_comment', 'reviewed_by', 'reviewed_at',
        'medicine_suggestions',
        'r2_key', 'consent_text', 'consented_at',
        'ai_training_consent',
    ];

    protected $casts = [
        'raw_response'         => 'array',
        'constitution_report'  => 'array',
        'medicine_suggestions' => 'array',
        'teeth_marks'          => 'boolean',
        'cracks'               => 'boolean',
        'reviewed_at'          => 'datetime',
        'consented_at'         => 'datetime',
        'ai_training_consent'  => 'boolean',
    ];

    public function patient()  { return $this->belongsTo(User::class, 'patient_id'); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }

    /**
     * Brief 1A Phase 6.5 - serialize r2:// image_urls as short-lived
     * signed R2 GET URLs so the browser <img> tags can display them.
     * Internal code reading $assessment->image_url still gets the raw
     * r2://... value (Eloquent attribute getter), but toArray() /
     * response()->json($model) get a signed https URL. Frontend code
     * needs zero changes.
     */
    public function toArray()
    {
        $arr = parent::toArray();
        $url = $arr['image_url'] ?? null;
        if (! $url) return $arr;
        if (! str_starts_with($url, 'r2://')) return $arr;
        if ($url === 'r2://pending') return $arr;
        $key = $this->r2_key ?: substr($url, 5);
        if (! $key) return $arr;
        try {
            $s3      = \Storage::disk('r2')->getClient();
            $bucket  = config('filesystems.disks.r2.bucket');
            $command = $s3->getCommand('GetObject', [
                'Bucket' => $bucket,
                'Key'    => $key,
            ]);
            $signed  = $s3->createPresignedRequest($command, '+1 hour');
            $arr['image_url'] = (string) $signed->getUri();
        } catch (\Throwable $e) {
            \Log::warning('tongue_signed_get_url_failed', [
                'r2_key' => $key,
                'assessment_id' => $arr['id'] ?? null,
                'err' => $e->getMessage(),
            ]);
        }
        return $arr;
    }
}

class_alias(TongueAssessment::class, 'App\\Models\\TongueDiagnosis');
