<?php

return [
    'default' => env('DB_CONNECTION', 'mysql'),
    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'url' => env('DATABASE_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'hansmed'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => [
                PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false,
                // Persistent connection: Octane workers reuse the same
                // MySQL TCP socket across requests instead of doing a
                // fresh TLS handshake + auth each call. Saves ~200-500ms
                // per request when MySQL is on a separate Railway container.
                PDO::ATTR_PERSISTENT => true,
            ],
        ],
    ],
    // Redis connections (Brief #21 perf-opt, 2026-05-12).
    // Railway's Redis service binding injects REDIS_HOST, REDIS_PORT,
    // REDIS_PASSWORD env vars. predis/predis is used as the client
    // (pure-PHP, no docker-php-ext-install redis needed). Two
    // connections: 'default' for general use, 'cache' as the
    // dedicated cache store (separate DB index so cache:clear doesn't
    // touch session/queue data).
    'redis' => [
        'client' => env('REDIS_CLIENT', 'predis'),
        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', 'hansmed_database_'),
        ],
        'default' => [
            'url'      => env('REDIS_URL'),
            'host'     => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD'),
            'port'     => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],
        'cache' => [
            'url'      => env('REDIS_URL'),
            'host'     => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD'),
            'port'     => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],
    ],
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],
];
