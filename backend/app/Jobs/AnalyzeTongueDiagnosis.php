<?php

namespace App\Jobs;

use App\Models\TongueDiagnosis;
use App\Services\NotificationService;
use App\Services\TongueDiagnosisClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AnalyzeTongueDiagnosis implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(public int $diagnosisId) {}

    public function handle(TongueDiagnosisClient $client, NotificationService $notifier): void
    {
        $diag = TongueDiagnosis::find($this->diagnosisId);
        if (! $diag || $diag->status === 'completed') return;

        $result = $client->analyze($diag->image_url);
        $diag->fill($result)->save();

        if (($result['status'] ?? null) === 'completed') {
            $notifier->notify(
                $diag->patient_id,
                'tongue.completed',
                'Tongue analysis ready',
                'Your tongue diagnosis report is available.',
                ['diagnosis_id' => $diag->id],
            );
            // Alert every approved doctor that there's a new tongue
            // diagnosis in the review pool — frontend plays the
            // "review" sound cue on these notifications.
            $notifier->reviewPendingForDoctors('tongue', $diag->id, (int) $diag->patient_id);
        }
    }

    public function failed(\Throwable $e): void
    {
        TongueDiagnosis::where('id', $this->diagnosisId)
            ->update(['status' => 'failed']);
    }
}
