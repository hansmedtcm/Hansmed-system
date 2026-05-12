<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // CORS hotfix 2026-05-12 — explicitly prepend HandleCors at the
        // top of the global stack. Laravel 11 auto-registers HandleCors
        // by default, but in production under Octane + FrankenPHP we
        // observed ZERO CORS headers being emitted on any /api/*
        // response (browser shows "Failed to fetch" on cross-origin
        // requests from hansmedtcm.com). Pre-pending it here forces it
        // into the resolved middleware list regardless of whether
        // auto-discovery is firing under the persistent-worker model.
        //
        // Safe to keep even after the underlying cause is identified —
        // Laravel deduplicates middleware classes in the pipeline, so
        // an explicit prepend on top of an auto-registered entry runs
        // once, not twice.
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'registration.complete' => \App\Http\Middleware\EnsureRegistrationComplete::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
        ]);
        $middleware->statefulApi();
        // Defensive HTTP security headers on every API response —
        // CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
        // Referrer-Policy, Permissions-Policy. See the middleware
        // file for what each one does and why.
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
    })
    ->withSchedule(function (Schedule $schedule) {
        // Brief 1A Phase 5 — daily R2 cleanup of soft-deleted tongue
        // images older than 7 days. 03:00 UTC = 11:00 KL time, sits in
        // the low-traffic window for Malaysian patients.
        //
        // Cron registration on Railway is deferred to Phase 9 — until
        // then this only fires when something invokes
        // `php artisan schedule:run` (which Railway's web container
        // does NOT do today). Run manually if needed:
        //   railway ssh "php artisan tongue:purge-expired-r2"
        $schedule->command('tongue:purge-expired-r2')->dailyAt('03:00');

        // Brief 1A Phase 9 (Item 3) — orphan-row cleanup. Soft-deletes
        // tongue rows stuck in image_url='r2://pending' state for >24h
        // (start-upload happened, complete-upload never came).
        //
        // Scheduled at 03:00 UTC (same as the expired-R2 purge above).
        // Laravel's scheduler runs due commands sequentially in a single
        // schedule:run invocation, so packing both at 03:00 means the
        // Railway cron service only needs to fire ONCE per day instead
        // of twice — saves container-minute cost on the hobby plan.
        // The two commands touch disjoint row sets (this one targets
        // r2://pending rows; the other targets soft-deleted rows), so
        // running back-to-back has no race condition.
        // Manual: railway ssh "php artisan tongue:purge-orphans"
        $schedule->command('tongue:purge-orphans')->dailyAt('03:00');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // BUG-011 — Unauthenticated API requests should return HTTP 401,
        // not 403. Laravel 11's default exception renderer returns 403
        // when an AuthenticationException is thrown on an API route
        // that has no redirect target. Force JSON 401 for anything
        // under /api/* so the frontend can distinguish "not logged in"
        // (prompt login) from "logged in but forbidden" (show denied).
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });
    })->create();
