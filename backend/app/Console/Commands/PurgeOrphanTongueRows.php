<?php

namespace App\Console\Commands;

use App\Models\TongueAssessment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Brief 1A Phase 9 (Item 3) — Orphan tongue row cleanup.
 *
 * Soft-deletes rows that have been stuck in 'r2://pending' state for
 * more than 24 hours. These are leftovers from sessions where:
 *   - Patient called start-upload, never PUT to R2 (closed the tab)
 *   - Patient called start-upload, PUT succeeded, but never called
 *     complete-upload (network dropped between step 2 and 3)
 *   - Phase 9 Item 2 ContentLength enforcement rejected an oversize
 *     upload — the row gets status='failed' but image_url stays
 *     'r2://pending' so this command notices it on the next run
 *
 * For each orphan: best-effort delete the R2 object (might not exist
 * if PUT never happened — that's fine), then soft-delete the row.
 * The 7-day purge cron (tongue:purge-expired-r2) eventually GCs the
 * row's r2_key.
 *
 * Run via:
 *   php artisan tongue:purge-orphans
 *
 * Scheduled via bootstrap/app.php's withSchedule() at 03:30 UTC,
 * 30 min after the expired-R2 purge so the two never overlap.
 *
 * Idempotent: re-running finds 0 candidates the second time because
 * SoftDeletes' default scope hides the rows we just deleted.
 *
 * Failure handling: each row's R2 delete + row delete is wrapped in
 * its own try/catch so a single permission glitch doesn't abort the
 * whole batch. Failures are logged with key context and counted; the
 * command still exits 0 because the batch ran. Exit 1 is reserved
 * for outright DB connection / query failure.
 */
class PurgeOrphanTongueRows extends Command
{
    protected $signature   = 'tongue:purge-orphans';
    protected $description = 'Soft-delete tongue rows stuck in r2://pending state >24h';

    public function handle(): int
    {
        $cutoff = now()->subHours(24);
        try {
            $candidates = TongueAssessment::where('image_url', 'r2://pending')
                ->where('created_at', '<', $cutoff)
                ->get();
        } catch (\Throwable $e) {
            $this->error('DB query failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        $total  = $candidates->count();
        $purged = 0;
        $failed = 0;

        $this->info(sprintf(
            '[%s] tongue:purge-orphans — %d candidate%s (created_at < %s)',
            now()->toIso8601String(),
            $total,
            $total === 1 ? '' : 's',
            $cutoff->toIso8601String()
        ));

        foreach ($candidates as $a) {
            // Best-effort R2 delete. The object might not exist (if the
            // PUT never happened) — that's fine, log info and continue.
            // We don't bail on R2 delete failure because the row itself
            // still needs to be soft-deleted; the 7-day purge job will
            // GC any leftover r2_key on its next pass.
            if ($a->r2_key) {
                try {
                    Storage::disk('r2')->delete($a->r2_key);
                } catch (\Throwable $e) {
                    Log::info('tongue_orphan_r2_delete_skipped', [
                        'r2_key'        => $a->r2_key,
                        'assessment_id' => $a->id,
                        'reason'        => $e->getMessage(),
                    ]);
                }
            }

            try {
                $a->delete();   // SoftDeletes — sets deleted_at
                $purged++;
                $this->line('  soft-deleted assessment ' . $a->id . ' (created ' . $a->created_at->toIso8601String() . ')');
            } catch (\Throwable $e) {
                $failed++;
                $this->warn('  FAILED to soft-delete assessment ' . $a->id . ' — ' . $e->getMessage());
                Log::warning('tongue_orphan_soft_delete_failed', [
                    'assessment_id' => $a->id,
                    'err'           => $e->getMessage(),
                ]);
            }
        }

        $this->newLine();
        $this->info(sprintf('Purged %d / %d. Failed %d.', $purged, $total, $failed));
        return self::SUCCESS;
    }
}
