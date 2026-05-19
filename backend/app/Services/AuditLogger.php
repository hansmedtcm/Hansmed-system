<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

/**
 * AuditLogger — single funnel for writes to audit_logs.
 *
 * Responsibilities:
 *   1. Pull ip_address + user_agent from the current request automatically
 *      (callers don't have to thread them through).
 *   2. Stamp created_at server-side.
 *   3. Compute the canonical-payload form (deterministic JSON).
 *   4. Acquire the chain head lock (SELECT ... FOR UPDATE on the singleton
 *      audit_chain_head row), read prev_hash.
 *   5. Compute row_hash = HMAC-SHA256(secret, prev_hash || canonical_payload).
 *   6. INSERT audit_logs row (with prev_hash + row_hash).
 *   7. UPDATE audit_chain_head SET last_id = NEW.id, last_hash = NEW.row_hash.
 *   8. All inside a single transaction. If anything throws, the row + the
 *      head update both roll back and the chain stays intact.
 *
 * The chain head row in audit_chain_head is the serialization point.
 * Concurrent writers all wait at the FOR UPDATE on PK = 1; gap locks on
 * audit_logs are not relied upon (see agent review for why
 * "SELECT ... FOR UPDATE on max(id) FROM audit_logs" is wrong).
 *
 * Threat model: an attacker with WRITE access to the DB can still
 * truncate audit_logs entirely, but cannot edit individual past rows
 * without breaking the chain. Verification via `audit:verify-chain`
 * detects all individual-row tampering. Wholesale truncation is
 * detected by external monitoring (row count + chain head pointer
 * shouldn't move backwards).
 */
class AuditLogger
{
    /**
     * Log a single audit event.
     *
     * @param array{
     *   user_id?: int|null,
     *   action: string,
     *   target_type?: string|null,
     *   target_id?: int|null,
     *   payload?: array|null,
     * } $event
     * @return AuditLog The persisted row, with row_hash populated.
     */
    public static function log(array $event): AuditLog
    {
        if (empty($event['action'])) {
            throw new \InvalidArgumentException('AuditLogger::log requires a non-empty action');
        }

        $request   = request();
        $ipAddress = $request?->ip();
        $userAgent = $request ? substr((string) $request->userAgent(), 0, 255) : null;
        $createdAt = now();

        $payload = $event['payload'] ?? null;

        $row = [
            'user_id'     => $event['user_id']     ?? null,
            'action'      => $event['action'],
            'target_type' => $event['target_type'] ?? null,
            'target_id'   => $event['target_id']   ?? null,
            'ip_address'  => $ipAddress,
            'user_agent'  => $userAgent,
            'payload'     => $payload,
            'created_at'  => $createdAt,
        ];

        return DB::transaction(function () use ($row) {
            // Lock the chain head FIRST. Any concurrent AuditLogger::log()
            // call blocks here until we commit/rollback. This is the
            // serialization point — NOT the audit_logs table itself.
            $head = DB::table('audit_chain_head')
                ->where('id', 1)
                ->lockForUpdate()
                ->first();

            if (! $head) {
                // Self-heal: the chain head row should always exist
                // (seeded by schema.sql + migration), but if a test DB
                // is loaded from a partial dump it might not be there.
                DB::table('audit_chain_head')->insertOrIgnore([
                    'id' => 1, 'last_id' => null, 'last_hash' => null,
                ]);
                $head = DB::table('audit_chain_head')
                    ->where('id', 1)
                    ->lockForUpdate()
                    ->first();
            }

            $prevHash = $head->last_hash ?? null;
            $rowHash  = self::computeRowHash($prevHash, [
                'id'          => null, // not yet assigned; canonicalizer must drop nulls deterministically
                'user_id'     => $row['user_id'],
                'action'      => $row['action'],
                'target_type' => $row['target_type'],
                'target_id'   => $row['target_id'],
                'payload'     => $row['payload'],
                'created_at'  => $row['created_at']->toIso8601String(),
            ]);

            $log = AuditLog::create(array_merge($row, [
                'prev_hash' => $prevHash,
                'row_hash'  => $rowHash,
            ]));

            DB::table('audit_chain_head')->where('id', 1)->update([
                'last_id'   => $log->id,
                'last_hash' => $rowHash,
            ]);

            return $log;
        });
    }

    /**
     * Compute the HMAC-SHA256 row hash. Deterministic across PHP
     * runtime versions / locales / OSes via:
     *   - JSON_UNESCAPED_UNICODE  — no `\uXXXX` escapes that vary
     *   - JSON_UNESCAPED_SLASHES  — no `\/` escapes
     *   - JSON_PRESERVE_ZERO_FRACTION — `1.0` stays `1.0`, not `1`
     *   - JSON_THROW_ON_ERROR     — fail loud on bad UTF-8
     *   - Recursive ksort         — key order is fixed
     *   - serialize_precision = -1 (PHP 7.1+ default) for float stability
     *
     * Used by both the write path and the verification artisan, so the
     * exact same canonicalization runs in both. Public + static so tests
     * can call directly.
     */
    public static function computeRowHash(?string $prevHash, array $fields): string
    {
        $secret = (string) env('HANSMED_AUDIT_LOG_HMAC_KEY', '');
        if ($secret === '') {
            throw new \RuntimeException(
                'HANSMED_AUDIT_LOG_HMAC_KEY env var is unset. ' .
                'AuditLogger refuses to compute hashes without a secret — ' .
                'an empty key produces deterministic-but-trivially-forgeable hashes.'
            );
        }

        $canonical = self::canonicalJson($fields);
        $material  = ($prevHash ?? '') . '|' . $canonical;

        return hash_hmac('sha256', $material, $secret);
    }

    /**
     * Canonical JSON encoding for hash material. NOT for storage —
     * the payload column is stored as the original JSON. This is the
     * deterministic form used ONLY when computing row_hash.
     */
    public static function canonicalJson(mixed $value): string
    {
        // Snapshot + force the highest float precision once. PHP's default
        // since 7.1 is -1 (full precision); we set it explicitly so a
        // weird php.ini override on a deploy machine doesn't silently
        // produce mismatched hashes between writer and verifier.
        $oldPrecision = ini_get('serialize_precision');
        ini_set('serialize_precision', '-1');

        try {
            $normalized = self::normalize($value);
            return json_encode(
                $normalized,
                JSON_UNESCAPED_UNICODE
                | JSON_UNESCAPED_SLASHES
                | JSON_PRESERVE_ZERO_FRACTION
                | JSON_THROW_ON_ERROR,
            );
        } finally {
            ini_set('serialize_precision', (string) $oldPrecision);
        }
    }

    /**
     * Recursively normalize a value for canonical JSON:
     *   - assoc arrays:  ksort keys, recurse on values
     *   - list arrays:   recurse on values, preserve order
     *   - scalars:       pass through unchanged (json_encode handles types)
     *   - null:          unchanged (json_encode -> "null")
     */
    private static function normalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        // Detect list vs assoc. array_is_list returns true for [0,1,2,...]
        // contiguous integer keys starting at 0.
        if (array_is_list($value)) {
            return array_map([self::class, 'normalize'], $value);
        }
        ksort($value, SORT_STRING);
        return array_map([self::class, 'normalize'], $value);
    }
}
