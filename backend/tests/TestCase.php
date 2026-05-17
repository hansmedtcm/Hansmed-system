<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Base TestCase for all HansMed feature tests.
 *
 * Notes:
 * - `RefreshDatabase` resets the test DB between tests using transactions
 *   when supported (MySQL with InnoDB) or full migrate:fresh otherwise.
 *   CI uses sqlite in-memory; production uses Railway MySQL — both work.
 * - Existing tests (AuthTest, BookingFlowTest, PrescriptionOrderFlowTest)
 *   were authored against this base but the class never existed; the
 *   Day 5 Week-1 CI bootstrap added it as the first foundation step.
 */
abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;
}
