<?php

/*
 |--------------------------------------------------------------------------
 | HansMed CORS hotfix (2026-05-12) — set at entry-point level
 |--------------------------------------------------------------------------
 | Multiple Laravel-level CORS fix attempts (HandleCors prepend, custom
 | HansMedCors middleware, Caddyfile at the FrankenPHP layer) all failed
 | to emit Access-Control-* headers in production. Cause not yet
 | identified — possibly stale config:cache, Laravel auto-discovery
 | regression, or middleware-registration interaction.
 |
 | Bypass the whole problem by setting CORS headers HERE, before Laravel
 | bootstrap, before autoload, before anything Laravel does. PHP's
 | header() calls are guaranteed to land in the response unless something
 | explicitly removes them — and nothing in Laravel removes raw PHP
 | headers it didn't set.
 |
 | OPTIONS preflight short-circuits with a 204 before Laravel even loads.
 |
 | Allowed origins match config/cors.php (kept in sync deliberately).
 | Remove this block once the Laravel-level CORS is verified working.
 */
// OPTIONS-only path. Plan K now scoped strictly to preflight requests
// so it can't collide with Laravel's HandleCors middleware (which now
// runs correctly post-PatientProfile fatal fix). For non-OPTIONS
// requests, Plan K is intentionally a no-op — Laravel's HandleCors
// sets the Access-Control-Allow-Origin header on the actual response,
// and we don't want two layers fighting over it.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    $hansmed_origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    $hansmed_allowed = [
        'https://hansmedtcm.com',
        'https://www.hansmedtcm.com',
        'https://hansmedtcm.github.io',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
    ];
    if ($hansmed_origin !== '' && in_array($hansmed_origin, $hansmed_allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $hansmed_origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Accept, Authorization, Content-Type, X-Requested-With, X-CSRF-TOKEN');
        header('Access-Control-Max-Age: 86400');
        header('Vary: Origin');
        http_response_code(204);
        exit;
    }
}

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
)->send();

$kernel->terminate($request, $response);
