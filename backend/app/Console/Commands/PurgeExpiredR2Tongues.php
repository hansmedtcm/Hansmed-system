<?php

namespace App\Console\Commands;

use App\Models\TongueAssessment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Brief 1A Phase 5 — daily R2 cleanup of soft-deleted tongue images.
 *
 * Scheduled via bootstrap/app.php's withSchedule() at 03:00 UTC
 * (= 11:00 KL time, low-traffic window). Can also be invoked manually:
 *
 *   railway ssh "php artisan tongue:purge-expired-r2"
 *
 * Until the Phase 9 follow-up wires a Railway cron service, run
 * weekly by hand if needed.
 *
 * Logic: any tongue_assessments row that was soft-deleted >7 days
 * ago AND still has an r2_key gets:
 *   1. Storage::disk('r2')->delete($r2_key)
 *   2. r2_key set to null on the row, save (forceSaveQuietly so we
 *      don't bump updated_at and don't trigger model events)
 *
 * The row itself stays soft-deleted — clinical/audit fields
 * (constitution_report, consent_text, etc.) are preserved per
 * Brief 1A's PDPA design. Only image bytes are purged.
 *
 * Idempotent: re-running finds 0 candidates the second time
 * because the WHERE filters on r2_key NOT NULL.
 *
 * Failure handling: each row's R2 delete is wrapped in its own
 * try/catch so a single bucket-permission glitch on one key doesn't
 * abort the whole batch. Failures are logged with key context and
 * counted; the command still exits 0 because the batch ran. Exit 1
 * is reserved for outright DB connection / query failure.
 */
class PurgeExpiredR2Tongues extends Command
{
    protected $signature   = 'tongue:purge-expired-r2';
    protected $description = 'Hard-delete R2 objects for tongue assessments soft-deleted >7 days ago';

    public function handle(): int
    {
        $cutoff = now()->subDays(7);
        try {
            $candidates = TongueAssessment::onlyTrashed()
                ->where('deleted_at', '<', $cutoff)
                ->whereNotNull('r2_key')
                ->get();
        } catch (\Throwable $e) {
            $this->error('DB query failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        $total    = $candidates->count();
        $purged   = 0;
        $failed   = 0;

        $this->info(sprintf(
            '[%s] tongue:purge-expired-r2 — %d candidate%s (deleted_at < %s)',
            now()->toIso8601String(),
            $total,
            $total === 1 ? '' : 's',
            $cutoff->toIso8601String()
        ));

        foreach ($candidates as $a) {
            $key = $a->r2_key;
            try {
                Storage::disk('r2')->delete($key);
                $purged++;
                $this->line('  purged ' . $key);
            } catch (\Throwable $e) {
                $failed++;
                $this->warn('  FAILED ' . $key . ' — ' . $e->getMessage());
                \Log::warning('tongue_purge_r2_failed', [
                    'r2_key'        => $key,
                    'assessment_id' => $a->id,
                    'err'           => $e->getMessage(),
                ]);
                // Continue — don't null r2_key if we couldn't actually
                // delete the object (otherwise we'd lose the pointer
                // and the orphan would be invisible to next run).
                continue;
            }

            // Null r2_key so the next run skips this row. Use
            // forceSaveQuietly to bypass SoftDeletes' restoring guard
            // and to avoid bumping updated_at on a row the user
            // already considers deleted.
            $a->r2_key = null;
            $a->saveQuietly();
        }

        $this->newLine();
        $this->info(sprintf('Purged %d / %d. Failed %d.', $purged, $total, $failed));
        return self::SUCCESS;
    }
}
