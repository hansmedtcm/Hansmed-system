<?php

return [
    'name' => env('APP_NAME', 'HansMed'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    // Application timezone — used by Carbon::now(), DB datetime casts,
    // job scheduling, audit_logs.created_at, etc. Set to GMT+8 because
    // HansMed currently operates only in Malaysia and patients book
    // appointments in local wall-clock (the booking flow strips
    // timezone markers before sending). Keeping this as 'UTC' caused
    // a split where appointment times read as local but every
    // Laravel-written timestamp (created_at / audit logs / published_at)
    // read as UTC — confusing to administrators reviewing logs.
    //
    // If HansMed ever expands to a second timezone (e.g. opens an
    // Indonesian or Thai branch), revisit by either (a) keeping each
    // deployment timezoned to its region, or (b) switching to UTC at
    // the DB layer and converting on display per-user.
    'timezone' => env('APP_TIMEZONE', 'Asia/Kuala_Lumpur'),
    'locale' => 'en',
    'fallback_locale' => 'en',
    'faker_locale' => 'en_US',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'previous_keys' => [...array_filter(explode(',', env('APP_PREVIOUS_KEYS', '')))],
    'maintenance' => ['driver' => env('APP_MAINTENANCE_DRIVER', 'file')],
    'providers' => Illuminate\Support\ServiceProvider::defaultProviders()->merge([
        App\Providers\AppServiceProvider::class,
    ])->toArray(),
];
