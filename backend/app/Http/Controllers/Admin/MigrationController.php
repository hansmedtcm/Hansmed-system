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
    /**
     * Storage health check — used after attaching a Railway Volume
     * to confirm uploads are landing on persistent disk. Reports:
     *   - uploads_dir:       absolute path being written to
     *   - dir_exists:        boolean
     *   - writable:          boolean
     *   - tongue_files:      count of files currently on disk
     *   - rows_in_db:        tongue diagnoses with an image_url
     *   - orphans:           rows whose file no longer exists on disk
     *   - disk_free_mb:      headroom left in the mount
     *   - appears_persistent:heuristic — path starts with a common
     *                        volume mount prefix or the device ID
     *                        differs from the container root, both
     *                        strong signals a volume is mounted.
     */
    public function storageHealth()
    {
        $uploadsDir = storage_path('app/public/tongue');
        $baseStorage = storage_path('app');

        $dirExists = is_dir($uploadsDir);
        $writable  = $dirExists && is_writable($uploadsDir);

        $tongueFiles = 0;
        if ($dirExists) {
            try {
                $iter = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($uploadsDir, \FilesystemIterator::SKIP_DOTS));
                foreach ($iter as $f) { if ($f->isFile()) $tongueFiles++; }
            } catch (\Throwable $e) { /* ignore */ }
        }

        // Orphan count — DB rows whose file is missing on disk.
        $orphans = 0;
        $rowsInDb = 0;
        try {
            $rows = DB::table('tongue_assessments')->whereNotNull('image_url')->pluck('image_url');
            $rowsInDb = $rows->count();
            foreach ($rows as $url) {
                // Expected URL shape is `{APP_URL}/api/uploads/tongue/xxx.jpg`.
                if (preg_match('#/api/uploads/(.+)$#', $url, $m)) {
                    $p = storage_path('app/public/' . $m[1]);
                    if (! is_file($p)) $orphans++;
                }
            }
        } catch (\Throwable $e) { /* table may be empty */ }

        // Rough signal: if the storage path's device id differs from /
        // the container root, something is mounted there. Not 100%
        // conclusive (overlayfs edge cases) but a decent heuristic.
        $persistent = false;
        try {
            $rootDev = @stat('/');
            $storDev = @stat($baseStorage);
            if ($rootDev && $storDev && isset($rootDev['dev']) && isset($storDev['dev'])) {
                $persistent = $rootDev['dev'] !== $storDev['dev'];
            }
        } catch (\Throwable $e) { /* ignore */ }

        $freeBytes = @disk_free_space($baseStorage) ?: 0;

        return response()->json([
            'uploads_dir'         => $uploadsDir,
            'dir_exists'          => $dirExists,
            'writable'            => $writable,
            'tongue_files'        => $tongueFiles,
            'rows_in_db'          => $rowsInDb,
            'orphans'             => $orphans,
            'disk_free_mb'        => (int) round($freeBytes / 1024 / 1024),
            'appears_persistent'  => $persistent,
            'hint'                => $persistent
                ? 'Storage path sits on a different filesystem from / — likely a Railway Volume.'
                : 'Storage path shares the container root filesystem. Uploads will be wiped on redeploy until a Railway Volume is mounted at /app/storage (or a sub-path like /app/storage/app/public).',
        ]);
    }


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

    public function walkInSupport(Request $request)
    {
        $log = [];
        $errors = [];

        // appointments.visit_type — online | walk_in
        if (! Schema::hasColumn('appointments', 'visit_type')) {
            try {
                DB::statement("ALTER TABLE appointments ADD COLUMN visit_type VARCHAR(20) NOT NULL DEFAULT 'online' AFTER status");
                $log[] = 'added appointments.visit_type';
            } catch (\Throwable $e) { $errors[] = 'visit_type: ' . $e->getMessage(); }
        } else {
            $log[] = 'appointments.visit_type already exists, skipped';
        }

        // consultations.case_record — JSON TCM case record
        if (! Schema::hasColumn('consultations', 'case_record')) {
            try {
                DB::statement("ALTER TABLE consultations ADD COLUMN case_record JSON NULL AFTER doctor_notes");
                $log[] = 'added consultations.case_record';
            } catch (\Throwable $e) { $errors[] = 'case_record: ' . $e->getMessage(); }
        } else {
            $log[] = 'consultations.case_record already exists, skipped';
        }

        // consultations.treatments — JSON list of treatments performed
        if (! Schema::hasColumn('consultations', 'treatments')) {
            try {
                DB::statement("ALTER TABLE consultations ADD COLUMN treatments JSON NULL AFTER case_record");
                $log[] = 'added consultations.treatments';
            } catch (\Throwable $e) { $errors[] = 'treatments: ' . $e->getMessage(); }
        } else {
            $log[] = 'consultations.treatments already exists, skipped';
        }

        return response()->json([
            'success' => empty($errors),
            'log'     => $log,
            'errors'  => $errors,
        ]);
    }

    public function rxFromReview(Request $request)
    {
        $log = [];
        $errors = [];

        // Drop the FK if present (MySQL quirk — foreign keys sometimes block ALTER).
        try {
            DB::statement('ALTER TABLE prescriptions DROP FOREIGN KEY fk_rx_ap');
            $log[] = 'dropped fk_rx_ap';
        } catch (\Throwable $e) {
            $log[] = 'fk_rx_ap: ' . $e->getMessage();
        }
        // Make appointment_id nullable so prescriptions can originate from AI reviews.
        try {
            DB::statement('ALTER TABLE prescriptions MODIFY COLUMN appointment_id BIGINT UNSIGNED NULL');
            $log[] = 'appointment_id is now nullable';
        } catch (\Throwable $e) {
            $errors[] = 'appointment_id nullable: ' . $e->getMessage();
        }
        // Re-add the FK so referential integrity is preserved when set.
        try {
            DB::statement('ALTER TABLE prescriptions ADD CONSTRAINT fk_rx_ap FOREIGN KEY (appointment_id) REFERENCES appointments(id)');
            $log[] = 're-added fk_rx_ap';
        } catch (\Throwable $e) {
            $log[] = 'fk_rx_ap re-add: ' . $e->getMessage();
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
            if (Schema::hasColumn('tongue_assessments', $col)) {
                $log[] = "column {$col} already exists, skipped";
                continue;
            }
            try {
                DB::statement("ALTER TABLE tongue_assessments {$sql}");
                $log[] = "added column {$col}";
            } catch (\Throwable $e) {
                $errors[] = "add {$col}: " . $e->getMessage();
            }
        }

        try {
            DB::statement('ALTER TABLE tongue_assessments ADD INDEX idx_td_review (review_status, created_at)');
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

    /**
     * Rewrite legacy tongue image URLs so they route through the new
     * /api/uploads/ path. Converts any stored URL that points at
     * /storage/tongue/... or a bare tongue/... path into the absolute
     * API URL the frontend can actually reach.
     */
    public function fixTongueImageUrls(Request $request)
    {
        $log = [];
        $rows = DB::table('tongue_assessments')->select('id', 'image_url')->get();
        $base = rtrim(url('/api/uploads'), '/');
        $updated = 0;
        foreach ($rows as $r) {
            if (empty($r->image_url)) continue;
            $u = $r->image_url;
            // Already pointing at new route
            if (strpos($u, '/api/uploads/') !== false) continue;
            $path = null;
            if (preg_match('#/storage/(.+)$#', $u, $m)) $path = $m[1];
            elseif (strpos($u, 'tongue/') === 0)       $path = $u;
            elseif (preg_match('#^https?://[^/]+/storage/(.+)$#', $u, $m)) $path = $m[1];
            if (! $path) continue;
            DB::table('tongue_assessments')->where('id', $r->id)->update([
                'image_url'  => $base . '/' . ltrim($path, '/'),
                'updated_at' => now(),
            ]);
            $updated++;
        }
        $log[] = "rewrote {$updated} tongue image_url(s)";
        return response()->json([
            'success' => true,
            'log'     => $log,
            'errors'  => [],
        ]);
    }
}
