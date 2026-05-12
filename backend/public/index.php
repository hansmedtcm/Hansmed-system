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
$hansmed_origin   = $_SERVER['HTTP_ORIGIN'] ?? '';
$hansmed_allowed  = [
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

    // Preflight short-circuit. Reply 204 with the headers above and
    // exit before Laravel boots — saves the full framework cycle on
    // every OPTIONS request and guarantees no Laravel middleware can
    // strip the headers we just set.
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
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
