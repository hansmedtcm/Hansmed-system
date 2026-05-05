<?php

namespace App\Console\Commands;

use Aws\S3\S3Client;
use Illuminate\Console\Command;

/**
 * Brief 1A Phase 1.3 — One-time CORS configuration for the R2 bucket.
 *
 * Run AFTER the R2 env vars are set on Railway:
 *
 *   railway run php artisan r2:setup-cors
 *
 * Idempotent: putBucketCors() replaces the entire CORS config each call,
 * so re-running just re-asserts the rules. Safe to run again if the
 * allowed-origins list changes.
 *
 * Why we set this from code rather than the Cloudflare dashboard UI:
 *   - Dashboard CORS form on R2 has fewer fields than the S3 API
 *     accepts (no per-method granularity, no MaxAgeSeconds).
 *   - Code-as-config: the allowlist lives in version control, so
 *     changes are reviewable + revertable.
 *   - Re-runnable on every environment without click-ops drift.
 */
class SetupR2Cors extends Command
{
    protected $signature   = 'r2:setup-cors';
    protected $description = 'Configure CORS rules on the R2 bucket (one-time setup, idempotent)';

    public function handle(): int
    {
        $bucket = config('filesystems.disks.r2.bucket');
        if (! $bucket) {
            $this->error('R2_BUCKET env var is empty. Aborting.');
            return self::FAILURE;
        }

        $client = new S3Client([
            'version'                 => 'latest',
            'region'                  => config('filesystems.disks.r2.region'),
            'endpoint'                => config('filesystems.disks.r2.endpoint'),
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key'    => config('filesystems.disks.r2.key'),
                'secret' => config('filesystems.disks.r2.secret'),
            ],
        ]);

        // Production frontend origins. github.io kept as transition fallback
        // (matches backend/config/cors.php Brief #21 allowlist).
        $allowedOrigins = [
            'https://hansmedtcm.com',
            'https://www.hansmedtcm.com',
            'https://hansmedtcm.github.io',
        ];
        if (app()->environment('local')) {
            $allowedOrigins[] = 'http://localhost:8000';
            $allowedOrigins[] = 'http://localhost:5173';
            $allowedOrigins[] = 'http://localhost:3000';
        }

        try {
            $client->putBucketCors([
                'Bucket' => $bucket,
                'CORSConfiguration' => [
                    'CORSRules' => [[
                        'AllowedOrigins' => $allowedOrigins,
                        'AllowedMethods' => ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                        'AllowedHeaders' => ['*'],
                        'ExposeHeaders'  => ['ETag'],
                        'MaxAgeSeconds'  => 3600,
                    ]],
                ],
            ]);
        } catch (\Throwable $e) {
            $this->error('putBucketCors failed: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info('R2 CORS configured on bucket "' . $bucket . '" for:');
        foreach ($allowedOrigins as $o) {
            $this->line('  - ' . $o);
        }
        return self::SUCCESS;
    }
}
