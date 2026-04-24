<?php

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
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'registration.complete' => \App\Http\Middleware\EnsureRegistrationComplete::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
        ]);
        $middleware->statefulApi();
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
