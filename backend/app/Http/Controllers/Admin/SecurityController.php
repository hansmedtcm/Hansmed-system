<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Admin Security actions — platform-wide authentication operations.
 *
 * Built 2026-05-14 (Day 1 of credential rotation cleanup) after a
 * Sanctum token briefly shipped inside .claude/settings.local.json.
 * Lives permanently in the admin portal so future incidents can be
 * handled through the same audited path instead of ad-hoc shells.
 *
 * Hardened 2026-05-16 (post-breach Day 2 hardening) per the Day 1
 * Security Researcher review:
 *   • Audit log is now written BEFORE the destructive operation
 *     (intent row) and AFTER (result row), not just after. This
 *     guarantees that a transaction rollback can never elide the
 *     forensic trail. Both audit writes are outside the revoke
 *     transaction.
 *   • The route is rate-limited via `throttle:3,60` middleware in
 *     routes/api.php — see the route registration. Three requests
 *     per minute is enough for legitimate emergency use but blocks
 *     a stolen-token spam-revoke DOS pattern against other admins.
 */
class SecurityController extends Controller
{
    /**
     * Revoke every Sanctum personal access token in the database.
     *
     * Body:
     *   confirm       (string, required, must equal "REVOKE-ALL")
     *   exclude_self  (bool,   optional, default true)
     *
     * Preserving the caller's own token (exclude_self=true) keeps the
     * admin signed-in long enough to confirm the operation succeeded.
     * Set exclude_self=false to nuke everything including the calling
     * session — the frontend should then log itself out.
     *
     * Audit log shape (audit_logs columns used):
     *   • action='security.revoke_all_tokens.initiated' — intent row,
     *     written BEFORE the destructive op. Payload records the
     *     planned scope so a stuck-in-progress revoke is forensically
     *     visible even if the transaction never completed.
     *   • action='security.revoke_all_tokens.completed' — result row,
     *     written AFTER the destructive op. Payload records the
     *     outcome (revoked count, success/failure).
     *   • action='security.revoke_all_tokens.failed' — failure row,
     *     written when the revoke transaction itself errors. The
     *     exception is re-thrown after the audit row is written so
     *     the API caller still sees the error.
     */
    public function revokeAllTokens(Request $request)
    {
        $data = $request->validate([
            'confirm'      => ['required', 'string', 'in:REVOKE-ALL'],
            'exclude_self' => ['nullable', 'boolean'],
        ]);

        $excludeSelf = array_key_exists('exclude_self', $data)
            ? (bool) $data['exclude_self']
            : true;

        $admin = $request->user();
        $currentTokenId = null;
        if ($excludeSelf && $admin && $admin->currentAccessToken()) {
            // currentAccessToken()->id is the row PK in personal_access_tokens
            $currentTokenId = $admin->currentAccessToken()->id;
        }

        $totalBefore = (int) DB::table('personal_access_tokens')->count();

        $ip = $request->ip();
        $userAgent = substr((string) $request->userAgent(), 0, 255);

        // ── Step 1: INTENT audit row (BEFORE the destructive op) ──
        // Wrapped in try so an audit-table outage can't block a
        // legitimate emergency revoke — but a warning is logged
        // loudly so the missed audit is visible in observability.
        // The destructive op proceeds even if the intent insert
        // failed, because the security event matters more than the
        // forensic trail. The result row below will still attempt
        // to write a record.
        try {
            AuditLogger::log([
                'user_id'     => $admin ? $admin->id : null,
                'action'      => 'security.revoke_all_tokens.initiated',
                'target_type' => 'personal_access_tokens',
                'target_id'   => null,
                'payload'     => [
                    'exclude_self'     => $excludeSelf,
                    'total_before'     => $totalBefore,
                    'current_token_id' => $currentTokenId,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('SecurityController::revokeAllTokens intent audit failed: ' . $e->getMessage(), [
                'admin_id'     => $admin ? $admin->id : null,
                'ip'           => $ip,
                'total_before' => $totalBefore,
            ]);
        }

        // ── Step 2: the destructive op ──
        try {
            $deleted = DB::transaction(function () use ($currentTokenId) {
                $q = DB::table('personal_access_tokens');
                if ($currentTokenId !== null) {
                    $q->where('id', '!=', $currentTokenId);
                }
                return $q->delete();
            });
        } catch (\Throwable $e) {
            // Write a failure audit row BEFORE re-throwing so the
            // partial event is forensically visible.
            try {
                AuditLogger::log([
                    'user_id'     => $admin ? $admin->id : null,
                    'action'      => 'security.revoke_all_tokens.failed',
                    'target_type' => 'personal_access_tokens',
                    'target_id'   => null,
                    'payload'     => [
                        'error'        => $e->getMessage(),
                        'total_before' => $totalBefore,
                    ],
                ]);
            } catch (\Throwable $auditErr) {
                Log::warning('SecurityController::revokeAllTokens failure-audit insert failed: ' . $auditErr->getMessage());
            }
            throw $e;
        }

        // ── Step 3: RESULT audit row (AFTER the destructive op) ──
        try {
            AuditLogger::log([
                'user_id'     => $admin ? $admin->id : null,
                'action'      => 'security.revoke_all_tokens.completed',
                'target_type' => 'personal_access_tokens',
                'target_id'   => null,
                'payload'     => [
                    'outcome'         => 'success',
                    'revoked'         => (int) $deleted,
                    'total_before'    => $totalBefore,
                    'kept_self_token' => $currentTokenId !== null,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('SecurityController::revokeAllTokens result audit failed: ' . $e->getMessage(), [
                'admin_id' => $admin ? $admin->id : null,
                'revoked'  => $deleted ?? null,
            ]);
        }

        return response()->json([
            'revoked'         => (int) $deleted,
            'total_before'    => $totalBefore,
            'kept_self_token' => $currentTokenId !== null,
            'message'         => $currentTokenId !== null
                ? 'All other sessions revoked. Your current session was preserved so you can confirm the result.'
                : 'All sessions revoked, including yours. Please sign in again.',
        ]);
    }
}
