<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

/**
 * Verify the HMAC chain over audit_logs.
 *
 *   php artisan audit:verify-chain
 *   php artisan audit:verify-chain --first-only
 *   php artisan audit:verify-chain --since=2026-05-19
 *
 * Iterates rows by id ASC, recomputes row_hash using the same canonical
 * form AuditLogger uses on insert, flags any row whose stored row_hash
 * differs from the recomputed value. Also verifies that prev_hash on
 * each row equals the previous row's row_hash (chain link integrity).
 *
 * Exit codes:
 *   0 — chain intact (all rows verified, OR no rows yet)
 *   1 — chain broken (at least one mismatch found)
 *   2 — infrastructure error (column missing, secret unset, etc.)
 *
 * Output: streams progress every 10k rows. With --first-only, stops at
 * the first break — useful in CI where a single broken row would
 * otherwise spam every subsequent row as a cascading false-positive.
 */
class AuditVerifyChain extends Command
{
    protected $signature = 'audit:verify-chain
                            {--first-only : Stop on the first broken row}
                            {--since= : Only verify rows with id >= the row whose created_at >= this date (YYYY-MM-DD)}';

    protected $description = 'Verify the HMAC chain integrity of audit_logs.';

    public function handle(): int
    {
        if (! \Schema::hasColumn('audit_logs', 'row_hash')) {
            $this->error('audit_logs.row_hash column is missing. Run migrations first.');
            return 2;
        }

        if (env('HANSMED_AUDIT_LOG_HMAC_KEY', '') === '') {
            $this->error('HANSMED_AUDIT_LOG_HMAC_KEY env var is unset. Cannot verify.');
            return 2;
        }

        $query = AuditLog::query()->orderBy('id');

        if ($since = $this->option('since')) {
            $sinceId = AuditLog::where('created_at', '>=', $since)->orderBy('id')->value('id');
            if ($sinceId) {
                $query->where('id', '>=', $sinceId);
                $this->info("Verifying from id >= {$sinceId} (created_at >= {$since}).");
            } else {
                $this->info("No rows found at or after {$since}. Nothing to verify.");
                return 0;
            }
        }

        $checked    = 0;
        $broken     = 0;
        $firstBreak = null;
        $prevHash   = null;
        $firstOnly  = (bool) $this->option('first-only');

        // chunkById is memory-stable and resumable even on very large logs.
        $query->chunkById(1000, function ($rows) use (
            &$checked, &$broken, &$firstBreak, &$prevHash, $firstOnly
        ) {
            foreach ($rows as $row) {
                $expectedRowHash = $row->recomputeRowHash();
                $linkOk          = ($row->prev_hash === $prevHash);
                $hashOk          = ($row->row_hash === $expectedRowHash);

                if (! $linkOk || ! $hashOk) {
                    $broken++;
                    if ($firstBreak === null) {
                        $firstBreak = [
                            'id'        => $row->id,
                            'link_ok'   => $linkOk,
                            'hash_ok'   => $hashOk,
                            'expected'  => $expectedRowHash,
                            'got'       => $row->row_hash,
                            'prev_got'  => $row->prev_hash,
                            'prev_want' => $prevHash,
                        ];
                    }
                    if ($firstOnly) {
                        return false; // signals chunkById to stop iterating
                    }
                }

                // Always advance using the row's STORED row_hash, not the
                // recomputed one — that way we detect every individually
                // tampered row, not just the first one.
                $prevHash = $row->row_hash;
                $checked++;
            }

            if ($checked % 10000 === 0) {
                $this->line("  …{$checked} rows checked, {$broken} broken so far");
            }
        });

        $this->newLine();
        $this->info("Checked: {$checked} rows.");

        if ($broken === 0) {
            $this->info('Chain intact. ✔');
            return 0;
        }

        $this->error("Broken rows: {$broken}");
        $this->newLine();
        $this->error('First break:');
        $this->line(json_encode($firstBreak, JSON_PRETTY_PRINT));
        return 1;
    }
}
