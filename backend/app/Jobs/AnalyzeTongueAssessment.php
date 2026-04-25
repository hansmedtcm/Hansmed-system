<?php

namespace App\Jobs;

use App\Models\TongueAssessment;
use App\Services\NotificationService;
use App\Services\TongueAssessmentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AnalyzeTongueAssessment implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(public int $assessmentId) {}

    public function handle(TongueAssessmentClient $client, NotificationService $notifier): void
    {
        $assessment = TongueAssessment::find($this->assessmentId);
        if (! $assessment || $assessment->status === 'completed') return;

        $result = $client->analyze($assessment->image_url);
        $assessment->fill($result)->save();

        if (($result['status'] ?? null) === 'completed') {
            $notifier->notify(
                $assessment->patient_id,
                'tongue.completed',
                'Wellness assessment ready',
                'Your tongue wellness assessment report is available.',
                ['diagnosis_id' => $assessment->id],
            );
            // Alert every approved doctor that there's a new tongue
            // assessment in the review pool — frontend plays the
            // "review" sound cue on these notifications.
            $notifier->reviewPendingForDoctors('tongue', $assessment->id, (int) $assessment->patient_id);
        }
    }

    public function failed(\Throwable $e): void
    {
        TongueAssessment::where('id', $this->assessmentId)
            ->update(['status' => 'failed']);
    }
}

/* Alias so any serialized job payloads from before this rename
 * still resolve to the new class on dequeue. Remove after queue
 * is fully drained (~24h post-deploy). */
class_alias(AnalyzeTongueAssessment::class, 'App\\Jobs\\AnalyzeTongueDiagnosis');
