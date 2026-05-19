<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * AuditLog — Eloquent representation of an audit_logs row.
 *
 * Inserts MUST go through App\Services\AuditLogger::log() rather than
 * AuditLog::create() directly. The chain head + canonical-payload +
 * HMAC computation lives in the service, not on the model, because the
 * service holds the serialization transaction. Bypassing the service
 * (e.g. AuditLog::create(...) or DB::table('audit_logs')->insert(...))
 * skips the chain entirely and produces unchained rows that the
 * `audit:verify-chain` artisan command will flag as broken.
 *
 * Reads via this model are fine — the model provides a clean reading
 * surface for the admin Audit Logs page (Admin\AuditLogController),
 * the verification artisan, and any future analytics.
 */
class AuditLog extends Model
{
    protected $table = 'audit_logs';

    // The chain itself, plus created_at, is set by AuditLogger. The
    // model has no updated_at column.
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'action', 'target_type', 'target_id',
        'ip_address', 'user_agent', 'payload',
        'prev_hash', 'row_hash', 'created_at',
    ];

    protected $casts = [
        'payload'    => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Convenience: recompute the HMAC for this row using the same
     * canonical-payload rules the service uses on insert. Used by the
     * `audit:verify-chain` artisan command. Returns the recomputed
     * hex digest; caller compares against $this->row_hash.
     */
    public function recomputeRowHash(): string
    {
        return \App\Services\AuditLogger::computeRowHash(
            $this->prev_hash,
            [
                'id'          => $this->id,
                'user_id'     => $this->user_id,
                'action'      => $this->action,
                'target_type' => $this->target_type,
                'target_id'   => $this->target_id,
                'payload'     => $this->payload,
                'created_at'  => $this->created_at?->toIso8601String(),
            ],
        );
    }
}
