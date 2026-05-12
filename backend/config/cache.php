<?php

return [
    'default' => env('CACHE_STORE', 'file'),
    'stores' => [
        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
        ],
        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],
        'database' => [
            'driver' => 'database',
            'connection' => env('DB_CACHE_CONNECTION'),
            'table' => env('DB_CACHE_TABLE', 'cache'),
            'lock_connection' => env('DB_CACHE_LOCK_CONNECTION'),
            'lock_table' => env('DB_CACHE_LOCK_TABLE'),
        ],
        // Redis cache store (Brief #21 perf-opt, 2026-05-12).
        // Connection details come from env REDIS_* set by Railway's
        // Redis service binding. Used for the hot admin endpoints
        // (/admin/accounts, /admin/patients, etc.) at 30-60s TTL —
        // 10x faster than the MySQL-bound path. predis/predis is the
        // pure-PHP client (no Docker extension install needed).
        'redis' => [
            'driver' => 'redis',
            'connection' => 'cache',
            'lock_connection' => 'default',
        ],
    ],
    'prefix' => env('CACHE_PREFIX', 'hansmed_cache_'),
];
