<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * AuditChainTest — proves the HMAC chain detects tampering.
 *
 * Three test methods:
 *   1. Inserting via AuditLogger produces chained rows; verify-chain passes.
 *   2. Tampering with a row's payload breaks verification.
 *   3. Backfill works against rows inserted without the chain (legacy
 *      DB::table inserts), and after backfill, the chain is intact.
 *
 * DatabaseTransactions wraps each test, so chain state from one test
 * never leaks into the next. The audit_chain_head row is also wrapped,
 * which means each test starts with a fresh "no prior chain" state.
 */
class AuditChainTest extends TestCase
{
    public function test_audit_logger_produces_chained_rows(): void
    {
        // Sanity — the singleton head row must exist (seeded by schema.sql).
        $head = DB::table('audit_chain_head')->where('id', 1)->first();
        $this->assertNotNull($head, 'audit_chain_head singleton row should be seeded by schema.sql');

        $a = AuditLogger::log([
            'action'      => 'test.event.a',
            'target_type' => 'user',
            'target_id'   => 1,
            'payload'     => ['note' => 'first'],
        ]);
        $b = AuditLogger::log([
            'action'      => 'test.event.b',
            'target_type' => 'user',
            'target_id'   => 1,
            'payload'     => ['note' => 'second'],
        ]);
        $c = AuditLogger::log([
            'action'      => 'test.event.c',
            'target_type' => 'user',
            'target_id'   => 1,
            'payload'     => ['note' => 'third'],
        ]);

        // Genesis row has prev_hash NULL; subsequent rows chain.
        $this->assertNull($a->prev_hash, 'Genesis row should have null prev_hash');
        $this->assertNotEmpty($a->row_hash, 'Row hash should be populated');
        $this->assertSame($a->row_hash, $b->prev_hash, 'Row B should chain to row A');
        $this->assertSame($b->row_hash, $c->prev_hash, 'Row C should chain to row B');

        // Chain head should point at the latest row.
        $head = DB::table('audit_chain_head')->where('id', 1)->first();
        $this->assertSame((int) $head->last_id, $c->id);
        $this->assertSame($head->last_hash, $c->row_hash);

        // Verify-chain artisan should pass.
        $exit = Artisan::call('audit:verify-chain');
        $this->assertSame(0, $exit, 'verify-chain should exit 0 on intact chain. Output: ' . Artisan::output());
    }

    public function test_tampering_with_a_row_breaks_verification(): void
    {
        AuditLogger::log([
            'action'  => 'test.tamper.a',
            'payload' => ['note' => 'pristine'],
        ]);
        $b = AuditLogger::log([
            'action'  => 'test.tamper.b',
            'payload' => ['note' => 'pristine'],
        ]);
        AuditLogger::log([
            'action'  => 'test.tamper.c',
            'payload' => ['note' => 'pristine'],
        ]);

        // Tamper: a malicious admin edits row B's payload via raw SQL.
        // The stored row_hash on B is unchanged (attacker can't compute
        // the new hash without the HMAC secret), so verification breaks.
        DB::table('audit_logs')
            ->where('id', $b->id)
            ->update(['payload' => json_encode(['note' => 'tampered'])]);

        $exit = Artisan::call('audit:verify-chain', ['--first-only' => true]);
        $this->assertSame(1, $exit, 'verify-chain should exit 1 on tampering. Output: ' . Artisan::output());

        $output = Artisan::output();
        $this->assertStringContainsString('Broken rows:', $output);
        $this->assertStringContainsString((string) $b->id, $output, 'First break should reference the tampered row id');
    }

    public function test_backfill_chains_legacy_unchained_rows(): void
    {
        // Simulate legacy direct-insert path that bypasses AuditLogger.
        // These rows have row_hash NULL — the state before the chain
        // feature shipped.
        $now = now();
        DB::table('audit_logs')->insert([
            ['action' => 'legacy.a', 'payload' => json_encode(['x' => 1]), 'created_at' => $now],
            ['action' => 'legacy.b', 'payload' => json_encode(['x' => 2]), 'created_at' => $now->copy()->addSecond()],
            ['action' => 'legacy.c', 'payload' => json_encode(['x' => 3]), 'created_at' => $now->copy()->addSeconds(2)],
        ]);

        $this->assertSame(3, AuditLog::whereNull('row_hash')->count(), 'Three legacy rows should need backfill');

        $exit = Artisan::call('audit:backfill-chain', ['--confirm' => true]);
        $this->assertSame(0, $exit, 'Backfill should exit 0. Output: ' . Artisan::output());

        $this->assertSame(0, AuditLog::whereNull('row_hash')->count(), 'All rows should have row_hash after backfill');

        // And the chain should now verify.
        $verifyExit = Artisan::call('audit:verify-chain');
        $this->assertSame(0, $verifyExit, 'After backfill, chain should verify. Output: ' . Artisan::output());
    }
}
