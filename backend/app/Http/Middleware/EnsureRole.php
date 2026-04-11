<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /** Usage in routes: ->middleware('role:doctor,admin') */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user || ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($user->status !== 'active') {
            return response()->json(['message' => 'Account not active'], 403);
        }
        return $next($request);
    }
}
