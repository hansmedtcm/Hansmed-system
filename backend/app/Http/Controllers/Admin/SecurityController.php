<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
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

        $deleted = DB::transaction(function () use ($currentTokenId) {
            $q = DB::table('personal_access_tokens');
            if ($currentTokenId !== null) {
                $q->where('id', '!=', $currentTokenId);
            }
            return $q->delete();
        });

        // Audit log — wrapped in try so an audit-table schema mismatch
        // can't roll the revoke back. The revoke is the security event;
        // missing audit is recoverable.
        try {
            DB::table('audit_logs')->insert([
                'user_id'     => $admin ? $admin->id : null,
                'action'      => 'security.revoke_all_tokens',
                'target_type' => 'personal_access_tokens',
                'target_id'   => null,
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('SecurityController::revokeAllTokens audit insert failed: ' . $e->getMessage());
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
