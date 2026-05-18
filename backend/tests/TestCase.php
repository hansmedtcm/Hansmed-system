<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

/**
 * Base TestCase for all HansMed feature tests.
 *
 * Database strategy:
 * - The test DB is real MySQL loaded once per CI run from
 *   backend/database/schema.sql (which is the source of truth for
 *   HansMed's ~30-table schema; the 5 Laravel migrations in
 *   backend/database/migrations/ are incremental on top of it).
 * - We use DatabaseTransactions rather than RefreshDatabase because
 *   RefreshDatabase re-runs migrations between test suites, which would
 *   tear down the schema.sql-loaded tables. DatabaseTransactions wraps
 *   each test in a transaction that rolls back at teardown, leaving the
 *   schema intact.
 * - For local development: see backend/phpunit.xml for instructions on
 *   spinning up a MySQL container and loading schema.sql before running
 *   PHPUnit. In CI, the .github/workflows/ci.yml backend-tests job
 *   handles this via a services: block.
 *
 * History: this class was first added on Day 5 (2026-05-17) when CI was
 * being bootstrapped — at the time it used RefreshDatabase against sqlite
 * in-memory, which silently boots only the 5 Laravel migrations' tables
 * and was the root cause of the Day 5 walk-back. The Week 1 schema-
 * sourcing decision (recorded in _internal/week-1-smoke-test-plan.md)
 * was to use MySQL service container + DatabaseTransactions, captured here.
 */
abstract class TestCase extends BaseTestCase
{
    use DatabaseTransactions;
}
