<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-shot backfill of prev_hash / row_hash for pre-existing audit_logs
 * rows that were written before the HMAC chain feature shipped.
 *
 *   php artisan audit:backfill-chain --confirm
 *   php artisan audit:backfill-chain --confirm --batch=500
 *   php artisan audit:backfill-chain --dry-run
 *
 * Strategy:
 *   1. Acquire a global advisory lock (GET_LOCK('hansmed_audit_backfill', 10))
 *      so a second concurrent backfill can't race us, and so any live
 *      AuditLogger::log() call running in parallel is forced to wait
 *      until backfill completes — protects chain integrity.
 *   2. Process WHERE row_hash IS NULL ORDER BY id ASC in batches.
 *   3. For each row, recompute against the immediately-preceding row's
 *      row_hash (NULL for the genesis row).
 *   4. UPDATE the row with prev_hash + row_hash inside a per-batch
 *      transaction. Resumable: if interrupted, the next run continues
 *      from the first row that still has row_hash IS NULL.
 *   5. At the end, update audit_chain_head to point at the last row.
 *
 * Refuses to run unless --confirm is passed (or --dry-run for inspection).
 *
 * Exit codes:
 *   0 — backfill complete (or nothing to do)
 *   1 — partial: errored mid-run, partial state left for next attempt
 *   2 — refused: --confirm missing, or column missing, or secret unset
 */
class AuditBackfillChain extends Command
{
    protected $signature = 'audit:backfill-chain
                            {--confirm : Required for any actual writes}
                            {--dry-run : Read-only; report what would change}
                            {--batch=1000 : Rows per batch transaction}';

    protected $description = 'Backfill prev_hash + row_hash on pre-chain audit_logs rows.';

    private const ADVISORY_LOCK = 'hansmed_audit_backfill';

    public function handle(): int
    {
        if (! \Schema::hasColumn('audit_logs', 'row_hash')) {
            $this->error('audit_logs.row_hash column missing. Run migrations first.');
            return 2;
        }
        if (env('HANSMED_AUDIT_LOG_HMAC_KEY', '') === '') {
            $this->error('HANSMED_AUDIT_LOG_HMAC_KEY env var is unset.');
            return 2;
        }
        if (! $this->option('confirm') && ! $this->option('dry-run')) {
            $this->error('Pass --confirm to run, or --dry-run to inspect.');
            return 2;
        }

        $dryRun  = (bool) $this->option('dry-run');
        $batch   = max(1, (int) $this->option('batch'));

        $remaining = AuditLog::whereNull('row_hash')->count();
        if ($remaining === 0) {
            $this->info('All audit_logs rows already have row_hash. Nothing to do.');
            return 0;
        }
        $this->info("{$remaining} rows need backfill. Batch size: {$batch}." . ($dryRun ? ' [DRY RUN]' : ''));

        // Advisory lock — blocks concurrent live writes inside AuditLogger
        // for the duration of the backfill. They'll wait on this same name.
        $lockAcquired = DB::selectOne("SELECT GET_LOCK(?, 10) AS got", [self::ADVISORY_LOCK])->got;
        if (! $lockAcquired) {
            $this->error('Could not acquire advisory lock. Another backfill may be running.');
            return 1;
        }

        try {
            // Anchor prev_hash from the last already-chained row (if any).
            $prevHash = AuditLog::whereNotNull('row_hash')->orderByDesc('id')->value('row_hash');

            $done = 0;
            while (true) {
                $rows = AuditLog::whereNull('row_hash')->orderBy('id')->limit($batch)->get();
                if ($rows->isEmpty()) break;

                DB::transaction(function () use ($rows, &$prevHash, $dryRun) {
                    foreach ($rows as $row) {
                        // MUST match AuditLogger::log()'s hash material
                        // exactly — id is deliberately excluded.
                        $expectedHash = AuditLogger::computeRowHash($prevHash, [
                            'user_id'     => $row->user_id,
                            'action'      => $row->action,
                            'target_type' => $row->target_type,
                            'target_id'   => $row->target_id,
                            'payload'     => $row->payload,
                            'created_at'  => $row->created_at?->toIso8601String(),
                        ]);

                        if (! $dryRun) {
                            DB::table('audit_logs')
                                ->where('id', $row->id)
                                ->update([
                                    'prev_hash' => $prevHash,
                                    'row_hash'  => $expectedHash,
                                ]);
                        }

                        $prevHash = $expectedHash;
                    }
                });

                $done += $rows->count();
                $this->line("  backfilled {$done} / {$remaining}");
            }

            if (! $dryRun) {
                // Advance the chain head to the final row.
                $tail = AuditLog::orderByDesc('id')->first();
                if ($tail) {
                    DB::table('audit_chain_head')->where('id', 1)->update([
                        'last_id'   => $tail->id,
                        'last_hash' => $tail->row_hash,
                    ]);
                }
            }

            $this->info($dryRun ? 'Dry run complete.' : 'Backfill complete. ✔');
            $this->info('Now run `php artisan audit:verify-chain` to confirm.');
            return 0;
        } finally {
            DB::statement('DO RELEASE_LOCK(?)', [self::ADVISORY_LOCK]);
        }
    }
}
