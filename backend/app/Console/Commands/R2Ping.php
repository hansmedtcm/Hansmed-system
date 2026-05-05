<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Brief 1A Phase 1.4 — R2 connectivity smoke test.
 *
 * Run via:
 *   railway run php artisan r2:ping
 *
 * Performs PUT → EXISTS → DELETE → EXISTS against a throwaway test key
 * and reports each step. Always cleans up its own object even on partial
 * failure (the cleanup path uses delete() which is idempotent).
 *
 * Exit code 0 = R2 reachable, creds valid, bucket writable.
 * Exit code 1 = something failed; the printed error message identifies
 *               which step (creds, network, permissions, bucket name).
 */
class R2Ping extends Command
{
    protected $signature   = 'r2:ping';
    protected $description = 'Verify the r2 disk works: put → exists → delete → exists';

    public function handle(): int
    {
        $key  = 'test/ping-' . now()->format('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.txt';
        $body = 'hello R2 — Brief 1A ping at ' . now()->toIso8601String();

        try {
            $this->line('1/4  Storage::disk(r2)->put('. $key .')');
            Storage::disk('r2')->put($key, $body);
            $this->info('     ok');

            $this->line('2/4  Storage::disk(r2)->exists('. $key .')  (expecting true)');
            $existsAfterPut = Storage::disk('r2')->exists($key);
            $this->info('     -> ' . var_export($existsAfterPut, true));
            if (! $existsAfterPut) {
                $this->error('     PUT reported success but EXISTS returned false. Aborting.');
                return self::FAILURE;
            }

            $this->line('3/4  Storage::disk(r2)->delete('. $key .')');
            Storage::disk('r2')->delete($key);
            $this->info('     ok');

            $this->line('4/4  Storage::disk(r2)->exists('. $key .')  (expecting false)');
            $existsAfterDelete = Storage::disk('r2')->exists($key);
            $this->info('     -> ' . var_export($existsAfterDelete, true));
            if ($existsAfterDelete) {
                $this->error('     DELETE reported success but EXISTS still true. Cleanup failed.');
                return self::FAILURE;
            }

            $this->newLine();
            $this->info('R2 ping PASSED — disk is reachable, writable, and deletable.');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            // Try a best-effort cleanup so we never leak the test object.
            try { Storage::disk('r2')->delete($key); } catch (\Throwable $_) {}

            $this->error('R2 ping FAILED on the step above.');
            $this->error('Exception: ' . get_class($e));
            $this->error('Message:   ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
