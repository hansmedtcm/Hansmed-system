<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;

/**
 * Provides createApplication() for tests that need to bootstrap Laravel
 * directly (not using the auto-included trait in the modern Laravel TestCase).
 * Kept for legacy compatibility with Laravel-style test scaffolds.
 */
trait CreatesApplication
{
    public function createApplication()
    {
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        return $app;
    }
}
