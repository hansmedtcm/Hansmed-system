<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route guard for per-user permissions.
 *
 * Usage in routes/api.php:
 *   Route::middleware('permission:view_earnings')->get(...)
 *   Route::middleware('permission:manage_finance,view_audit_logs')->get(...)   // all of
 *
 * Fails with 403 if the authenticated user lacks any of the listed permissions.
 * Admins bypass this check (they are assumed full-access unless denied via
 * an explicit user_permission_overrides row with granted=0).
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$perms): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        foreach ($perms as $p) {
            if (! $user->hasPermission($p)) {
                return response()->json([
                    'message'              => 'Insufficient permission',
                    'missing_permission'   => $p,
                ], 403);
            }
        }
        return $next($request);
    }
}
