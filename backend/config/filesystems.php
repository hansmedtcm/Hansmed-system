<?php

return [
    'default' => env('FILESYSTEM_DISK', 'local'),
    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app'),
        ],
        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
        ],

        /*
         * Brief 1A — Cloudflare R2 disk for tongue-image uploads.
         *
         * Uses the S3 driver (R2 is S3-API-compatible) but needs:
         *   - use_path_style_endpoint=true (R2 requires path-style, not subdomain)
         *   - region='auto' (R2 has no region concept; SDK requires the field)
         *   - visibility=private (tongue images NEVER public; access only via
         *                         signed URLs issued by the patient endpoint)
         *
         * Env vars are populated on Railway. Local dev leaves them blank;
         * if the disk is referenced without creds it'll throw on first call,
         * which is the desired loud failure (no silent fallback to local).
         */
        'r2' => [
            'driver'                  => 's3',
            'key'                     => env('R2_ACCESS_KEY_ID'),
            'secret'                  => env('R2_SECRET_ACCESS_KEY'),
            'region'                  => env('R2_REGION', 'auto'),
            'bucket'                  => env('R2_BUCKET'),
            'endpoint'                => env('R2_ENDPOINT'),
            'use_path_style_endpoint' => true,
            'throw'                   => true,
            'visibility'              => 'private',
        ],
    ],
    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
