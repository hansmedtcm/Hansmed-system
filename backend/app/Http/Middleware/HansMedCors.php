<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * HansMedCors — defensive CORS middleware.
 *
 * Why this exists:
 *   Laravel 11's auto-registered \Illuminate\Http\Middleware\HandleCors
 *   silently stops emitting CORS headers in production under
 *   Octane + FrankenPHP (root cause not yet identified — possibly
 *   config('cors') resolving empty after the persistent-worker boot,
 *   or HandleCors not getting registered in the global pipeline when
 *   Octane warms the application). Verified in prod 2026-05-12:
 *   EVERY /api/* response — OPTIONS preflight AND actual GET — came
 *   back with zero Access-Control-* headers, breaking the patient and
 *   doctor portals with browser "Failed to fetch" errors.
 *
 *   Rather than chase the Octane/HandleCors interaction further (the
 *   site is in soft-launch and CORS being broken is a hard outage),
 *   this middleware sets the headers directly. It runs as the FIRST
 *   middleware in the global stack so it can short-circuit OPTIONS
 *   preflight before anything else touches the request.
 *
 * Allowed origins are hardcoded — same set as config/cors.php but
 * deliberately duplicated here so this file is self-sufficient and
 * doesn't depend on config('cors') resolving correctly.
 *
 * Safe to remove if/when the underlying HandleCors interaction is
 * fixed and verified working end-to-end in production.
 */
class HansMedCors
{
    /**
     * Origins allowed to call the HansMed API cross-origin.
     * Hardcoded — see class docblock for why.
     */
    private const ALLOWED_ORIGINS = [
        'https://hansmedtcm.com',
        'https://www.hansmedtcm.com',
        'https://hansmedtcm.github.io',
        // Local development
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        // file:// previews report Origin: null
        'null',
    ];

    private const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    private const ALLOWED_HEADERS = 'Accept, Authorization, Content-Type, X-Requested-With, X-CSRF-TOKEN';
    private const MAX_AGE = '86400';

    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');

        // Not a cross-origin request — let it through without touching headers.
        if ($origin === null) {
            return $next($request);
        }

        // Origin not in the allowlist — pass through with NO CORS headers,
        // which causes the browser to reject the response. We deliberately
        // don't 403 the request server-side because a server-to-server
        // caller could legitimately send Origin and not care about CORS.
        if (! in_array($origin, self::ALLOWED_ORIGINS, true)) {
            return $next($request);
        }

        // Preflight: short-circuit with a 204 and the full CORS header set.
        // We do this BEFORE invoking $next() so the preflight never reaches
        // the route, auth middleware, or anything else that could 4xx it.
        if ($request->getMethod() === 'OPTIONS' && $request->headers->has('Access-Control-Request-Method')) {
            return response('', 204)
                ->withHeaders($this->preflightHeaders($origin));
        }

        // Actual request: let it run, then attach CORS headers to the
        // response on the way out. Use ->headers->set() (not ->withHeaders())
        // so we work on both Illuminate and Symfony Response instances.
        $response = $next($request);

        foreach ($this->actualRequestHeaders($origin) as $name => $value) {
            $response->headers->set($name, $value);
        }

        return $response;
    }

    /**
     * @return array<string, string>
     */
    private function preflightHeaders(string $origin): array
    {
        return [
            'Access-Control-Allow-Origin'   => $origin,
            'Access-Control-Allow-Methods'  => self::ALLOWED_METHODS,
            'Access-Control-Allow-Headers'  => self::ALLOWED_HEADERS,
            'Access-Control-Max-Age'        => self::MAX_AGE,
            'Vary'                          => 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function actualRequestHeaders(string $origin): array
    {
        return [
            'Access-Control-Allow-Origin' => $origin,
            'Vary'                        => 'Origin',
        ];
    }
}
