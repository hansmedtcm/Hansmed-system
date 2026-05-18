<?php

use App\Support\PhiScrubber;
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
        // Trust Railway's edge proxy. Without this, Laravel sees the
        // container-internal request as plain HTTP (Railway terminates
        // TLS at its edge and forwards plaintext to the container) and
        // emits redirect Location headers with http:// — which the
        // browser refuses to follow on a fetch/XHR. Symptom in the
        // browser: login appears to "time out" silently. Trusting all
        // proxies is fine here because the only ingress is Railway's
        // edge; there's no other path into the container.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'registration.complete' => \App\Http\Middleware\EnsureRegistrationComplete::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
            // Machine-to-machine bearer auth for the in-house IT agent.
            // See App\Http\Middleware\AgentTokenAuth for the contract.
            'agent.token' => \App\Http\Middleware\AgentTokenAuth::class,
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

        // ERROR MONITOR — write structured JSONL for the IT agent and admin
        // error dashboard. Skips expected HTTP noise (404, validation, auth,
        // CSRF) and writes everything else to storage/logs/errors.jsonl.
        // Format matches the ErrorEntry interface in error-log-tool.ts.
        $exceptions->report(function (\Throwable $e) {
            // Skip exceptions that are routine HTTP noise, not real bugs
            $noiseClasses = [
                \Illuminate\Auth\AuthenticationException::class,
                \Illuminate\Auth\Access\AuthorizationException::class,
                \Illuminate\Validation\ValidationException::class,
                \Illuminate\Database\Eloquent\ModelNotFoundException::class,
                \Symfony\Component\HttpKernel\Exception\NotFoundHttpException::class,
                \Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException::class,
                \Illuminate\Session\TokenMismatchException::class,
            ];
            foreach ($noiseClasses as $class) {
                if ($e instanceof $class) {
                    return false; // let Laravel handle normally, don't log
                }
            }

            // Skip 4xx HTTP exceptions that weren't caught above
            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                && $e->getStatusCode() < 500) {
                return false;
            }

            // Determine severity level
            $level = 'error';
            $criticalKeywords = ['out of memory', 'maximum execution time', 'database connection'];
            foreach ($criticalKeywords as $kw) {
                if (stripos($e->getMessage(), $kw) !== false) {
                    $level = 'critical';
                    break;
                }
            }

            $type        = get_class($e);
            $file        = $e->getFile();
            $line        = $e->getLine();
            $fingerprint = hash('sha256', $type . '|' . $file . '|' . $line);

            // PHI scrubbing — NRIC / email / MY-phone patterns can
            // bleed into exception messages and stack traces (e.g.
            // "Duplicate entry '950101-14-5678' for key
            // users_ic_number_unique"). Scrub before write so the
            // JSONL store and any downstream consumer (admin
            // dashboard, IT agent) only sees redacted values.
            $request    = request();
            $requestUrl = $request ? PhiScrubber::scrub($request->fullUrl()) : null;
            $userId     = $request && $request->user() ? $request->user()->id : null;

            $entry = [
                'id'          => (string) \Illuminate\Support\Str::uuid(),
                'fingerprint' => $fingerprint,
                'timestamp'   => now()->toIso8601String(),
                'source'      => 'backend',
                'level'       => $level,
                'type'        => $type,
                'message'     => PhiScrubber::scrub($e->getMessage()),
                'file'        => $file,
                'line'        => $line,
                'stack'       => PhiScrubber::scrub(
                                     collect(explode("\n", $e->getTraceAsString()))
                                         ->take(10)
                                         ->implode("\n")
                                 ),
                'url'         => $requestUrl,
                'user_id'     => $userId,
            ];

            $logPath = storage_path('logs/errors.jsonl');
            try {
                file_put_contents($logPath, json_encode($entry) . "\n", FILE_APPEND | LOCK_EX);
            } catch (\Throwable) {
                // Never let error logging crash the app — silently absorb
            }

            return false; // still allow Laravel's default channel logging
        });
    })->create();
