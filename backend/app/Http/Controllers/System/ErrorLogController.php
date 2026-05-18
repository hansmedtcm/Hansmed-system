<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Support\PhiScrubber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * ErrorLogController — endpoints for the in-house error monitoring
 * system that adapts Sentry's role inside HansMed.
 *
 * POST  /api/errors             — frontend JS error ingest (public,
 *                                 rate-limited, PHI-scrubbed on write).
 * GET   /api/admin/system/errors — admin dashboard read (Sanctum + role:admin).
 * GET   /api/agent/errors        — IT agent read (HANSMED_AGENT_TOKEN bearer).
 *
 * Both backend and frontend errors land in storage/logs/errors.jsonl.
 * Backend errors are written by the report() callback in bootstrap/app.php.
 * Frontend errors are written here.
 *
 * The JSONL format matches ErrorEntry in error-log-tool.ts.
 *
 * PHI scrubbing: applies to the `message`, `stack`, and `url` fields
 * on the ingest path. The report() callback in bootstrap/app.php does
 * the same for backend errors. See App\Support\PhiScrubber for the
 * patterns scrubbed.
 *
 * Auth model: the agent-token check that used to live in this
 * controller (the dual-auth `index` method) is gone. Each read path
 * now has its own route + middleware:
 *   • Admin dashboard → routes/api.php under auth:sanctum + role:admin
 *   • IT agent        → routes/api.php under 'agent.token' middleware
 * Both reach the same `index()` method below.
 */
class ErrorLogController extends Controller
{
    private const LOG_PATH = 'logs/errors.jsonl';

    // ─── POST /api/errors — frontend JS error ingest ─────────────────────────

    /**
     * Accept a structured error from the frontend error-monitor.js script.
     * Open to any origin (no auth) but rate-limited in routes/api.php.
     * Never returns error details — just 204 on success.
     */
    public function ingest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'    => ['required', 'string', 'max:200'],
            'message' => ['required', 'string', 'max:2000'],
            'file'    => ['nullable', 'string', 'max:500'],
            'line'    => ['nullable', 'integer'],
            'col'     => ['nullable', 'integer'],
            'stack'   => ['nullable', 'string', 'max:5000'],
            'url'     => ['nullable', 'string', 'max:500'],
            'level'   => ['nullable', 'string', 'in:warning,error,critical'],
        ]);

        $type        = $data['type'];
        $file        = $data['file'] ?? 'unknown';
        $line        = $data['line'] ?? 0;
        $fingerprint = hash('sha256', $type . '|' . $file . '|' . $line);

        // PHI scrubbing — runs BEFORE storage. message/stack/url can
        // incidentally contain NRIC/email/phone in patient-facing JS
        // errors. See App\Support\PhiScrubber for the patterns.
        $entry = [
            'id'          => (string) Str::uuid(),
            'fingerprint' => $fingerprint,
            'timestamp'   => now()->toIso8601String(),
            'source'      => 'frontend',
            'level'       => $data['level'] ?? 'error',
            'type'        => $type,
            'message'     => PhiScrubber::scrub($data['message']),
            'file'        => $file,
            'line'        => $line,
            'stack'       => PhiScrubber::scrub($data['stack'] ?? null),
            'url'         => PhiScrubber::scrub($data['url'] ?? null),
            'user_id'     => $request->user()?->id,
        ];

        try {
            file_put_contents(
                storage_path(self::LOG_PATH),
                json_encode($entry) . "\n",
                FILE_APPEND | LOCK_EX
            );
        } catch (\Throwable) {
            // Silent — never let error logging fail the request
        }

        return response()->json(null, 204);
    }

    // ─── GET /api/admin/system/errors  and  GET /api/agent/errors ─────────────

    /**
     * Return errors from the JSONL log filtered by `since` and `level`.
     * Auth is now handled at the route layer (see routes/api.php) — this
     * method assumes the request has already passed auth.
     *
     * Query params:
     *   since  — ISO 8601 timestamp (required; only entries at or after
     *            this time are returned)
     *   level  — 'warning' | 'error' | 'critical' (default: 'error')
     */
    public function index(Request $request): JsonResponse
    {
        $since    = $request->query('since');
        $minLevel = $request->query('level', 'error');

        $levelOrder = ['warning' => 0, 'error' => 1, 'critical' => 2];
        $minOrdinal = $levelOrder[$minLevel] ?? 1;

        $logPath = storage_path(self::LOG_PATH);
        if (! file_exists($logPath)) {
            return response()->json(['errors' => []]);
        }

        $errors = [];
        $handle = fopen($logPath, 'r');
        if ($handle === false) {
            return response()->json(['errors' => []]);
        }

        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if ($line === '') continue;

            $entry = json_decode($line, true);
            if (! is_array($entry)) continue;

            if ($since && isset($entry['timestamp'])) {
                if ($entry['timestamp'] < $since) continue;
            }

            $entryLevel   = $entry['level'] ?? 'error';
            $entryOrdinal = $levelOrder[$entryLevel] ?? 1;
            if ($entryOrdinal < $minOrdinal) continue;

            $errors[] = $entry;
        }
        fclose($handle);

        return response()->json(['errors' => $errors]);
    }
}
