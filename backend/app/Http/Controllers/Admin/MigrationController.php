<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-shot DB migrations callable from the admin UI.
 * Each migration is idempotent — safe to run multiple times.
 */
class MigrationController extends Controller
{
    public function poolBooking(Request $request)
    {
        $log = [];
        $errors = [];

        // 1. Make doctor_id nullable
        try {
            DB::statement('ALTER TABLE appointments MODIFY COLUMN doctor_id BIGINT UNSIGNED NULL');
            $log[] = 'doctor_id is now nullable';
        } catch (\Throwable $e) {
            $errors[] = 'doctor_id nullable: ' . $e->getMessage();
        }

        // 2. Add pool columns one by one (skip if already exist)
        $columns = [
            'concern'               => "ADD COLUMN concern VARCHAR(60) NULL",
            'concern_label'         => "ADD COLUMN concern_label VARCHAR(120) NULL",
            'recommended_specialty' => "ADD COLUMN recommended_specialty VARCHAR(120) NULL",
            'is_pool'               => "ADD COLUMN is_pool TINYINT(1) NOT NULL DEFAULT 0",
        ];
        foreach ($columns as $col => $sql) {
            if (Schema::hasColumn('appointments', $col)) {
                $log[] = "column {$col} already exists, skipped";
                continue;
            }
            try {
                DB::statement("ALTER TABLE appointments {$sql}");
                $log[] = "added column {$col}";
            } catch (\Throwable $e) {
                $errors[] = "add {$col}: " . $e->getMessage();
            }
        }

        // 3. Add index for fast pool queries
        try {
            DB::statement('ALTER TABLE appointments ADD INDEX idx_ap_pool (is_pool, scheduled_start)');
            $log[] = 'added pool index';
        } catch (\Throwable $e) {
            // Likely "Duplicate key name" — that's fine.
            $log[] = 'pool index: ' . $e->getMessage();
        }

        return response()->json([
            'success' => empty($errors),
            'log'     => $log,
            'errors'  => $errors,
        ]);
    }

    public function doctorOffDays(Request $request)
    {
        $log = [];
        $errors = [];

        if (! Schema::hasColumn('doctor_profiles', 'off_days')) {
            try {
                DB::statement("ALTER TABLE doctor_profiles ADD COLUMN off_days JSON NULL AFTER accepting_appointments");
                $log[] = 'added column off_days';
            } catch (\Throwable $e) {
                $errors[] = 'add off_days: ' . $e->getMessage();
            }
        } else {
            $log[] = 'column off_days already exists, skipped';
        }

        return response()->json([
            'success' => empty($errors),
            'log'     => $log,
            'errors'  => $errors,
        ]);
    }

    public function tongueReview(Request $request)
    {
        $log = [];
        $errors = [];

        $columns = [
            'review_status'        => "ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER health_score",
            'doctor_comment'       => "ADD COLUMN doctor_comment TEXT NULL AFTER review_status",
            'reviewed_by'          => "ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER doctor_comment",
            'reviewed_at'          => "ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by",
            'medicine_suggestions' => "ADD COLUMN medicine_suggestions JSON NULL AFTER reviewed_at",
        ];
        foreach ($columns as $col => $sql) {
            if (Schema::hasColumn('tongue_diagnoses', $col)) {
                $log[] = "column {$col} already exists, skipped";
                continue;
            }
            try {
                DB::statement("ALTER TABLE tongue_diagnoses {$sql}");
                $log[] = "added column {$col}";
            } catch (\Throwable $e) {
                $errors[] = "add {$col}: " . $e->getMessage();
            }
        }

        try {
            DB::statement('ALTER TABLE tongue_diagnoses ADD INDEX idx_td_review (review_status, created_at)');
            $log[] = 'added review index';
        } catch (\Throwable $e) {
            $log[] = 'review index: ' . $e->getMessage();
        }

        return response()->json([
            'success' => empty($errors),
            'log'     => $log,
            'errors'  => $errors,
        ]);
    }
}
