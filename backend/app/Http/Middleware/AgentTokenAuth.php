<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * AgentTokenAuth — bearer-token middleware for machine-to-machine
 * endpoints consumed by the in-house IT agent.
 *
 * Usage in routes/api.php:
 *   Route::middleware('agent.token')->get('/agent/errors', ...);
 *
 * Verifies the Authorization header against the HANSMED_AGENT_TOKEN
 * env var using hash_equals (constant-time comparison — defends
 * against timing attacks). Returns 401 with no leak of the expected
 * value if the token is missing, malformed, or mismatched.
 *
 * If HANSMED_AGENT_TOKEN is unset on the environment, the endpoint
 * is FAIL-CLOSED — no request succeeds. This is deliberate:
 * forgetting to configure the env var should not silently leave
 * the endpoint open.
 */
class AgentTokenAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) env('HANSMED_AGENT_TOKEN', '');
        if ($expected === '') {
            return response()->json([
                'message' => 'Agent endpoint not configured (HANSMED_AGENT_TOKEN unset).',
            ], 401);
        }

        $header = (string) $request->header('Authorization', '');
        $provided = '';
        if (str_starts_with($header, 'Bearer ')) {
            $provided = substr($header, 7);
        }

        if ($provided === '' || ! hash_equals($expected, $provided)) {
            return response()->json([
                'message' => 'Invalid agent token.',
            ], 401);
        }

        return $next($request);
    }
}
