<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeTongueAssessment;
use App\Models\TongueAssessment;
use App\Services\TongueAssessment\KnowledgeBase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TongueAssessmentController extends Controller
{
    // C-04: upload tongue image and run analysis synchronously.
    //
    // Previously this queued a job for a background worker — but the Railway
    // single-container deploy doesn't run `queue:work`, so jobs piled up in
    // the DB forever and the frontend polling timed out at 90s.
    //
    // Running sync is fine here: Claude Vision typically returns in 5–15s
    // which sits well inside a normal HTTP window, and the user gets the
    // result on the very first poll instead of waiting for worker pickup.
    public function store(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:8192'],
        ]);

        // Bump PHP's execution ceiling in case the upstream AI call runs long
        @set_time_limit(120);

        $path = $request->file('image')->store('tongue', 'public');

        // Serve images through our own API route so the URL works from any
        // frontend host. Storage::url() returns paths relative to APP_URL
        // which isn't reliable on Railway's split frontend/backend setup.
        $url = url('/api/uploads/' . $path);

        $assessment = TongueAssessment::create([
            'patient_id' => $request->user()->id,
            'image_url'  => $url,
            'status'     => 'processing',
        ]);

        try {
            // dispatchSync runs the job inline in this request — no queue
            // worker required. If the AI provider errors out, the job's
            // handle() still writes status=failed via $assessment->fill()->save()
            // so the patient sees a clean error instead of an indefinite spinner.
            AnalyzeTongueAssessment::dispatchSync($assessment->id);
        } catch (\Throwable $e) {
            \Log::error('tongue_analysis_sync_failed', ['id' => $assessment->id, 'err' => $e->getMessage()]);
            TongueAssessment::where('id', $assessment->id)->update([
                'status' => 'failed',
            ]);
        }

        // Response key kept as 'diagnosis' for frontend backward-compat.
        // Frontend reads `res.diagnosis` everywhere; renaming the JSON key
        // would force a parallel frontend deploy. Safe to keep — the row's
        // table name is what matters legally, not the JSON key.
        return response()->json(['diagnosis' => $assessment->fresh()], 202);
    }

    // C-07: history
    //
    // Brief 1A Phase 5 — accepts an optional ?include_trashed=true query
    // param so a "Recently Deleted" UI can list soft-deleted rows
    // alongside active ones (within the 7-day undo window). Default
    // behaviour is unchanged: soft-deleted rows are filtered out by
    // the SoftDeletes trait's global scope.
    public function index(Request $request)
    {
        $query = TongueAssessment::where('patient_id', $request->user()->id);

        if ($request->boolean('include_trashed')) {
            $query->withTrashed();
        }

        return response()->json(
            $query->orderByDesc('created_at')->paginate(20)
        );
    }

    public function show(Request $request, int $id)
    {
        $assessment = TongueAssessment::where('patient_id', $request->user()->id)->findOrFail($id);
        return response()->json(['diagnosis' => $assessment]);
    }

    /**
     * Brief 1A Phase 5 — single-row soft-delete with 7-day undo window.
     *
     * Deliberate: do NOT touch R2. The image stays in the bucket for 7
     * days so the patient can hit POST .../{id}/restore if they
     * change their mind. The PurgeExpiredR2Tongues artisan command
     * (scheduled daily at 03:00 UTC via bootstrap/app.php's
     * withSchedule()) sweeps soft-deleted rows older than 7 days and
     * hard-deletes their R2 objects, then nulls r2_key on the row.
     *
     * Clinical/audit fields (constitution_report, raw_response,
     * doctor_comment, etc.) are preserved on the soft-deleted row —
     * only the image bytes get purged. The row itself stays for
     * audit trail (consent_text, consented_at, deleted_at).
     *
     * For the immediate PDPA right-of-erasure path (delete-everything-
     * NOW with no undo), see deleteAll() below.
     */
    public function destroy(Request $request, int $id)
    {
        $assessment = TongueAssessment::where('patient_id', $request->user()->id)
            ->findOrFail($id);
        $assessment->delete();   // SoftDeletes trait — sets deleted_at = now()

        return response()->json([
            'ok'                 => true,
            'recoverable_until'  => now()->addDays(7)->toIso8601String(),
            'undo_endpoint'      => '/api/patient/tongue-assessments/' . $assessment->id . '/restore',
        ]);
    }

    /**
     * Brief 1A Phase 5 — un-soft-delete within the 7-day grace window.
     *
     * Rejection cases (in order):
     *   - 404 if no row matches OR the row is already active
     *     (not soft-deleted). Both surface as the same not-found
     *     response so we don't leak the existence of an active row
     *     under a wrong id.
     *   - 410 Gone if deleted_at is older than 7 days. The cron may
     *     have already purged the R2 object; restoring would yield
     *     a row whose image_url points at nothing.
     *   - 410 Gone if r2_key is set but the R2 object is already
     *     missing. Defensive — covers the case where the cron ran
     *     between the request landing and us reaching this check,
     *     or where someone deleted the R2 object out-of-band.
     *
     * On success the SoftDeletes trait's restore() clears deleted_at.
     *
     * POST /api/patient/tongue-assessments/{id}/restore
     */
    public function restore(Request $request, int $id)
    {
        $assessment = TongueAssessment::withTrashed()
            ->where('patient_id', $request->user()->id)
            ->findOrFail($id);

        if (! $assessment->trashed()) {
            // Not soft-deleted — nothing to restore. 404 rather than
            // 422 to keep the response shape uniform with the not-found
            // case above (no leakage of active-row existence).
            return response()->json(['message' => 'Not found'], 404);
        }

        if ($assessment->deleted_at && $assessment->deleted_at->lt(now()->subDays(7))) {
            return response()->json([
                'message' => 'Restore window expired (7 days). The image has already been purged.',
            ], 410);
        }

        if ($assessment->r2_key && ! Storage::disk('r2')->exists($assessment->r2_key)) {
            return response()->json([
                'message' => 'Image already purged from storage. Restore would leave a broken record.',
            ], 410);
        }

        $assessment->restore();   // clears deleted_at

        return response()->json([
            'ok'            => true,
            'assessment_id' => $assessment->id,
            'status'        => $assessment->status,
        ]);
    }

    /**
     * Brief 1A Phase 5 — PDPA right-of-erasure bulk delete.
     *
     * Hard-purges R2 objects for ALL of this patient's tongue
     * assessments (active + already soft-deleted) and soft-deletes
     * any rows still active. r2_key is nulled so the row's residual
     * audit trail clearly indicates the image is gone.
     *
     * Differences from destroy():
     *   - Operates on EVERY row owned by the patient.
     *   - R2 objects are purged immediately, no 7-day grace.
     *   - No restore endpoint applies — once R2 is gone, restore()
     *     would yield broken records.
     *   - Requires explicit confirm string in the body to defend
     *     against accidental fat-finger DELETE on the collection
     *     route. UI must surface a typed-confirmation modal.
     *
     * Wrapped in a DB transaction so a partial-failure leaves the
     * patient's row state internally consistent. R2 delete failures
     * are logged but DO NOT abort — the row-level soft-delete is
     * the legally binding act under PDPA. We surface the deleted
     * row count in the response, not the R2 success count.
     *
     * Clinical/audit fields (constitution_report, raw_response,
     * doctor_comment, consent_text, consented_at) are preserved by
     * design — see Brief 1A Phase 5 sub-rules.
     *
     * DELETE /api/patient/tongue-assessments
     * Body: { "confirm": "DELETE_ALL_MY_TONGUE_DATA" }
     */
    public function deleteAll(Request $request)
    {
        $data = $request->validate([
            'confirm' => ['required', 'string'],
        ]);
        if ($data['confirm'] !== 'DELETE_ALL_MY_TONGUE_DATA') {
            return response()->json([
                'message' => 'Confirmation string mismatch. Refusing to bulk-delete.',
            ], 422);
        }

        $patientId = $request->user()->id;
        $count = 0;

        \DB::transaction(function () use ($patientId, &$count) {
            $rows = TongueAssessment::withTrashed()
                ->where('patient_id', $patientId)
                ->get();

            foreach ($rows as $a) {
                if ($a->r2_key) {
                    try {
                        Storage::disk('r2')->delete($a->r2_key);
                    } catch (\Throwable $e) {
                        // Log + continue — the row-level delete below is the
                        // PDPA-required action; an R2 failure leaves an
                        // orphaned object we can sweep later.
                        Log::warning('tongue_bulk_delete_r2_failed', [
                            'r2_key'      => $a->r2_key,
                            'assessment_id' => $a->id,
                            'patient_id'  => $patientId,
                            'err'         => $e->getMessage(),
                        ]);
                    }
                    $a->r2_key = null;
                    $a->save();   // persist the r2_key=null even if not yet trashed
                }

                if (! $a->trashed()) {
                    $a->delete();   // soft-delete
                }
                $count++;
            }
        });

        return response()->json([
            'ok'            => true,
            'deleted_count' => $count,
            'message'       => 'All your tongue assessments have been permanently deleted from our systems.',
        ]);
    }

    // C-05/C-06: tongue knowledge reference (public glossary)
    public function knowledgeBase()
    {
        return response()->json(KnowledgeBase::getFullSchema());
    }

    /*
     * ───────────────────────────────────────────────────────────────
     * Brief 1A Phase 3 — direct browser → R2 upload, two-step flow.
     *
     * Replaces the legacy proxy upload (store()) with a pattern where
     * the browser PUTs the file straight to Cloudflare R2 using a
     * short-lived signed URL. The Laravel server only signs the URL
     * and verifies the upload after the fact — image bytes never
     * touch the API container, which means:
     *   - No multipart-form size limits / PHP upload_max_filesize
     *   - No Railway egress for the upload itself
     *   - Faster client-side feedback (single PUT, no proxy hop)
     *
     * The legacy store() / index() / show() / destroy() endpoints stay
     * unchanged — both flows coexist during the transition.
     * ───────────────────────────────────────────────────────────────
     */

    /**
     * Step 1 of 2 — issue a 5-minute presigned PUT URL and pre-create
     * the assessment row in 'uploaded' state with image_url set to the
     * 'r2://pending' placeholder.
     *
     * Why a placeholder vs nullable image_url: tongue_assessments.image_url
     * is NOT NULL in the schema and we deliberately don't relax that —
     * downstream code (doctor review, exports) treats null as "no image"
     * which is the wrong signal for "upload in flight". Distinguishing
     * states purely via image_url's value keeps the schema honest.
     *
     * Status reuses the existing 'uploaded' enum value because adding
     * a new 'pending_upload' value would require an ALTER on a prod
     * table that already has rows. Step 2 (completeUpload) flips
     * image_url to the real r2://<key> path and bumps status to
     * 'processing' before running analysis — same transition the
     * legacy store() does.
     *
     * POST /api/patient/tongue-assessments/start-upload
     */
    public function startUpload(Request $request)
    {
        $data = $request->validate([
            // Filename only — file bytes go directly to R2, never here.
            // Regex locks the extension to jpg/jpeg/png so we can map
            // it to a Content-Type that the presigned URL pins.
            'filename'     => ['required', 'string', 'max:255', 'regex:/\\.(jpe?g|png)$/i'],
            // 1 KB lower bound rejects empty / accidental zero-byte
            // uploads. 10 MB upper bound matches the legacy store()
            // mimes:max:8192 (8 MB) plus headroom for modern phone
            // cameras at default quality.
            'file_size'    => ['required', 'integer', 'min:1024', 'max:10485760'],
            // Optional in this brief — Phase 8 makes it required and
            // wires the consent UI. We capture it now so any early
            // adopter testers who do tick a checkbox have it stored.
            'consent_text'        => ['nullable', 'string', 'max:2000'],
            // AI training consent — separate opt-in. Patient may consent
            // to treatment analysis (consent_text) but decline training.
            // Stored per-assessment so revocation of a later consent_grant
            // does not retroactively alter historical records; the column
            // reflects the patient's intent at upload time.
            'ai_training_consent' => ['nullable', 'boolean'],
        ]);

        $patient = $request->user();

        // Map extension → MIME. The presigned URL embeds this Content-Type
        // so a client that PUTs a different MIME (e.g. uploads a PDF as
        // .jpg) gets a 403 from R2 — defense against type spoofing.
        $ext  = strtolower(pathinfo($data['filename'], PATHINFO_EXTENSION));
        $ext  = $ext === 'jpeg' ? 'jpg' : $ext;
        $mime = match ($ext) {
            'jpg' => 'image/jpeg',
            'png' => 'image/png',
        };

        // Key layout: tongue/<patient_id>/<uuid>.<ext>
        // - patient_id prefix scopes all of one patient's images under
        //   a common path so admin tooling / future bulk-export per
        //   patient stays simple
        // - UUID prevents enumeration of other patients' keys even if
        //   the bucket is misconfigured publicly someday
        $r2Key = sprintf('tongue/%d/%s.%s', $patient->id, (string) Str::uuid(), $ext);

        $assessment = TongueAssessment::create([
            'patient_id'          => $patient->id,
            'image_url'           => 'r2://pending',     // overwritten in completeUpload
            'r2_key'              => $r2Key,
            'status'              => 'uploaded',         // see comment above re: enum reuse
            'consent_text'        => $data['consent_text'] ?? null,
            'consented_at'        => isset($data['consent_text']) ? now() : null,
            'ai_training_consent' => (bool) ($data['ai_training_consent'] ?? false),
        ]);

        // Build the presigned URL. We go through Storage::disk('r2')->getClient()
        // rather than instantiating a fresh S3Client so we inherit any
        // request middleware / retry config Laravel attached to the disk.
        /** @var \Aws\S3\S3Client $s3 */
        $s3      = Storage::disk('r2')->getClient();
        $bucket  = config('filesystems.disks.r2.bucket');
        $command = $s3->getCommand('PutObject', [
            'Bucket'      => $bucket,
            'Key'         => $r2Key,
            'ContentType' => $mime,
        ]);
        $signed  = $s3->createPresignedRequest($command, '+5 minutes');
        $uploadUrl = (string) $signed->getUri();

        return response()->json([
            'assessment_id' => $assessment->id,
            'upload_url'    => $uploadUrl,
            'expires_in'    => 300,         // seconds; mirrors '+5 minutes' above
            'r2_key'        => $r2Key,
            // Echo back so the frontend can set the PUT request's
            // Content-Type header to exactly this value (must match
            // the signature, otherwise R2 returns 403 SignatureDoesNotMatch).
            'content_type'  => $mime,
        ], 201);
    }

    /**
     * Step 2 of 2 — browser tells us the R2 PUT finished. We verify
     * the object actually exists, flip image_url to the real key,
     * then run analysis SYNCHRONOUSLY (matching the legacy store()
     * pattern) and return the final result.
     *
     * Sync was chosen deliberately: Railway runs a single container
     * with no `queue:work`, so async dispatched jobs accumulate in the
     * DB forever. dispatchSync() runs analyze() inline (typically
     * 5-15s for Claude Vision) inside this HTTP request, so the
     * frontend gets the diagnosis on the same response with no
     * polling required. See store() comment for history.
     *
     * Response shape mirrors the legacy GET show() endpoint's
     * `diagnosis` key so the frontend (Phase 6) can render
     * results immediately without a follow-up fetch.
     *
     * POST /api/patient/tongue-assessments/{id}/complete-upload
     */
    public function completeUpload(Request $request, int $id)
    {
        $assessment = TongueAssessment::where('patient_id', $request->user()->id)
            ->findOrFail($id);

        // Reject any state that isn't "row pre-created, awaiting R2 PUT".
        // Re-running complete-upload after analysis already ran would
        // re-dispatch the job and either double-bill the AI call or
        // overwrite a completed analysis with a stale one.
        if ($assessment->image_url !== 'r2://pending') {
            return response()->json([
                'message' => 'Assessment is not in pending-upload state.',
                'state'   => $assessment->image_url === null ? 'unknown' : $assessment->status,
            ], 422);
        }

        // Verify the browser actually PUT the object. If the presigned
        // URL expired or the network call failed silently, we don't
        // want to send Claude Vision an empty fetch.
        if (! $assessment->r2_key || ! Storage::disk('r2')->exists($assessment->r2_key)) {
            return response()->json([
                'message' => 'Upload not found in R2 storage. Re-upload required.',
            ], 422);
        }

        // Brief 1A Phase 9 — ContentLength enforcement.
        // The presigned PUT URL doesn't enforce content-length-range,
        // so verify the actual stored object size BEFORE running the
        // AI call. 10 MB hard cap = 10 * 1024 * 1024 = 10485760 bytes
        // (matches the max in startUpload's validation rule).
        //
        // Defends against a client that declares file_size=1024 in
        // start-upload (passes server validation), receives the
        // presigned URL, then PUTs a 1 GB file. Without this check
        // we'd happily run AI on the oversize image and pay for the
        // R2 storage indefinitely.
        try {
            $actualSize = Storage::disk('r2')->size($assessment->r2_key);
        } catch (\Throwable $e) {
            // Size lookup failed despite exists() succeeding above —
            // very rare R2 hiccup. Log and fall through to AI rather
            // than blocking the upload on a transient error.
            Log::warning('tongue_size_check_failed', [
                'r2_key'        => $assessment->r2_key,
                'assessment_id' => $assessment->id,
                'err'           => $e->getMessage(),
            ]);
            $actualSize = null;
        }
        if ($actualSize !== null && $actualSize > 10485760) {
            // Purge the oversize object — patient declared a smaller
            // size and uploaded a larger one. Don't bill for AI
            // processing or keep paying R2 storage costs.
            try {
                Storage::disk('r2')->delete($assessment->r2_key);
            } catch (\Throwable $e) {
                Log::warning('tongue_oversize_purge_failed', [
                    'r2_key'        => $assessment->r2_key,
                    'assessment_id' => $assessment->id,
                    'size'          => $actualSize,
                    'err'           => $e->getMessage(),
                ]);
            }
            // Leave image_url as 'r2://pending' (don't flip to the
            // real key). The Phase 9 Item 3 orphan cleanup will
            // soft-delete this row 24h from now.
            $assessment->update(['status' => 'failed']);
            return response()->json([
                'message'     => 'Uploaded image exceeds 10 MB limit. Please retry with a smaller image.',
                'actual_size' => $actualSize,
            ], 422);
        }

        // Flip placeholder → real key; AnthropicTongueClient (Phase 4)
        // will recognise the r2:// prefix and fetch from R2 instead of
        // trying to download an HTTP URL.
        $assessment->update([
            'image_url' => 'r2://' . $assessment->r2_key,
            'status'    => 'processing',
        ]);

        // Bump PHP's execution ceiling for the AI call (same as store()).
        @set_time_limit(120);

        try {
            // dispatchSync runs handle() inline — no worker required.
            // The job's failed() handler writes status=failed if it
            // throws, so even a Claude API hiccup leaves the row in
            // a clean terminal state instead of stuck-in-processing.
            AnalyzeTongueAssessment::dispatchSync($assessment->id);
        } catch (\Throwable $e) {
            Log::error('tongue_analysis_sync_failed', [
                'id'  => $assessment->id,
                'err' => $e->getMessage(),
            ]);
            TongueAssessment::where('id', $assessment->id)
                ->update(['status' => 'failed']);
        }

        // Re-fetch so the response carries the final post-analysis state.
        $fresh = $assessment->fresh();

        return response()->json([
            'status'        => $fresh->status,        // 'completed' | 'failed' | (rarely) 'processing'
            'assessment_id' => $fresh->id,
            'diagnosis'     => $fresh,                // same shape as GET show()
        ]);
    }
}

/* Class alias so older route definitions or queue payloads referring
 * to the old class name keep working through one release cycle. */
class_alias(TongueAssessmentController::class, 'App\\Http\\Controllers\\Patient\\TongueDiagnosisController');
