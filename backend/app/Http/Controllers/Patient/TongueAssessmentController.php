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
    public function index(Request $request)
    {
        return response()->json(
            TongueAssessment::where('patient_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->paginate(20)
        );
    }

    public function show(Request $request, int $id)
    {
        $assessment = TongueAssessment::where('patient_id', $request->user()->id)->findOrFail($id);
        return response()->json(['diagnosis' => $assessment]);
    }

    public function destroy(Request $request, int $id)
    {
        TongueAssessment::where('patient_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
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
            'consent_text' => ['nullable', 'string', 'max:2000'],
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
            'patient_id'   => $patient->id,
            'image_url'    => 'r2://pending',     // overwritten in completeUpload
            'r2_key'       => $r2Key,
            'status'       => 'uploaded',         // see comment above re: enum reuse
            'consent_text' => $data['consent_text'] ?? null,
            'consented_at' => isset($data['consent_text']) ? now() : null,
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
