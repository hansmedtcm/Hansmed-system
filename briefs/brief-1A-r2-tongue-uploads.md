# Brief 1A — R2 Storage Integration for Tongue Uploads (REWRITTEN)

**Priority:** P1 — required for AI Wellness Assessment soft launch
**Estimated effort:** 8-10 hrs Claude Code work, ~1.5 days wall-clock
**Depends on:**
  - Partner has enabled R2 in Cloudflare ✅
  - Partner has created R2 bucket: `hansmed-tongue-images` ✅
  - Partner has generated R2 API token ✅
  - Partner has added 5 R2 env vars to Railway (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, R2_REGION)
  - Existing `TONGUE_API_KEY` env var on Railway (already set, do not change)

---

## 🚨 IMPORTANT: This brief INTEGRATES with the existing tongue system, not rebuild

After auditing the backend, we found you already have:

| File | Status |
|---|---|
| `app/Models/TongueAssessment.php` | ✅ Built |
| `app/Http/Controllers/Patient/TongueAssessmentController.php` | ✅ Built (sync upload + analysis) |
| `app/Http/Controllers/Doctor/TongueReviewController.php` | ✅ Built |
| `app/Jobs/AnalyzeTongueAssessment.php` | ✅ Built |
| `app/Services/AnthropicTongueClient.php` | ✅ Built (Claude Vision via TONGUE_API_KEY) |
| `app/Services/TongueAssessment/AnalysisReport.php` | ✅ Built (TCM mapper) |
| `app/Services/TongueAssessment/KnowledgeBase.php` | ✅ Built (Yin's framework) |
| Admin tongue config UI | ✅ Built (rotates keys at runtime) |
| `tongue_assessments` DB table | ✅ Built (rich schema) |
| 7 API routes (patient + doctor) | ✅ Wired |

**What's missing:**
- R2 storage backend (currently uses local disk `storage/app/public/`)
- Direct browser → R2 signed URL upload pattern (currently proxies through Laravel)
- Soft-delete with audit trail (currently hard-deletes)
- Consent capture for PDPA compliance
- "Delete from My Records" patient UI
- Privacy policy disclosure

This brief adds those 6 things WITHOUT rewriting any of the working code.

## Architectural decisions (confirmed by CEO)

1. **Upload flow:** Direct browser → R2 via signed URLs (replace existing proxy path)
2. **AI processing:** Existing AnthropicTongueClient via `TONGUE_API_KEY` (no changes)
3. **Retention:** Indefinite until user requests deletion (PDPA-compliant)
4. **Coexistence:** New R2 path runs alongside legacy local-disk path. No big-bang cutover.

---

## Phases

This brief runs in 9 phases. **Verify each phase before proceeding.**

### Phase 0 — Pre-flight (USER + PARTNER)

⚠️ Before Claude Code touches anything, confirm:

- [ ] R2 bucket `hansmed-tongue-images` exists ✅
- [ ] R2 API token created with "Object Read & Write" permission ✅
- [ ] All 5 R2 env vars on Railway:
  ```
  R2_ACCESS_KEY_ID=<your-access-key-id>
  R2_SECRET_ACCESS_KEY=<your-secret-access-key>
  R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
  R2_BUCKET=hansmed-tongue-images
  R2_REGION=auto
  ```
- [ ] Existing `TONGUE_API_KEY` still set (do NOT remove or rename)
- [ ] Existing `TONGUE_API_URL=anthropic` still set (or admin UI override active)
- [ ] Railway redeployed with new env vars

---

### Phase 1 — R2 disk configuration + bucket CORS

#### 1.1 Install AWS SDK for PHP

```
cd backend
composer require league/flysystem-aws-s3-v3:^3.0
composer require aws/aws-sdk-php
```

#### 1.2 Add R2 disk to `config/filesystems.php`

Add a new entry under `disks`:

```php
'r2' => [
    'driver' => 's3',
    'key' => env('R2_ACCESS_KEY_ID'),
    'secret' => env('R2_SECRET_ACCESS_KEY'),
    'region' => env('R2_REGION', 'auto'),
    'bucket' => env('R2_BUCKET'),
    'endpoint' => env('R2_ENDPOINT'),
    'use_path_style_endpoint' => true,  // R2 requires path-style
    'throw' => true,
    'visibility' => 'private',           // tongue images NEVER public
],
```

#### 1.3 Create one-shot CORS setup command

`backend/app/Console/Commands/SetupR2Cors.php`

```php
<?php
namespace App\Console\Commands;

use Aws\S3\S3Client;
use Illuminate\Console\Command;

class SetupR2Cors extends Command {
    protected $signature = 'r2:setup-cors';
    protected $description = 'Configure CORS rules on the R2 bucket (one-time setup)';

    public function handle() {
        $client = new S3Client([
            'version' => 'latest',
            'region'  => config('filesystems.disks.r2.region'),
            'endpoint' => config('filesystems.disks.r2.endpoint'),
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key' => config('filesystems.disks.r2.key'),
                'secret' => config('filesystems.disks.r2.secret'),
            ],
        ]);

        $allowedOrigins = [
            'https://hansmedtcm.com',
            'https://www.hansmedtcm.com',
            'https://hansmedtcm.github.io',  // transition fallback
        ];
        if (app()->environment('local')) {
            $allowedOrigins[] = 'http://localhost:8000';
            $allowedOrigins[] = 'http://localhost:5173';
        }

        $client->putBucketCors([
            'Bucket' => config('filesystems.disks.r2.bucket'),
            'CORSConfiguration' => [
                'CORSRules' => [[
                    'AllowedOrigins' => $allowedOrigins,
                    'AllowedMethods' => ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    'AllowedHeaders' => ['*'],
                    'ExposeHeaders' => ['ETag'],
                    'MaxAgeSeconds' => 3600,
                ]],
            ],
        ]);

        $this->info('R2 CORS configured for: ' . implode(', ', $allowedOrigins));
    }
}
```

Run once after deploy:
```
railway run php artisan r2:setup-cors
```

#### 1.4 Phase 1 verification

```
railway run php artisan tinker
>>> Storage::disk('r2')->put('test.txt', 'hello R2');
>>> Storage::disk('r2')->exists('test.txt');  // true
>>> Storage::disk('r2')->delete('test.txt');
>>> Storage::disk('r2')->exists('test.txt');  // false
```

If all 4 commands succeed → R2 connection works. **STOP HERE.**
Verify with user before Phase 2.

---

### Phase 2 — Extend `tongue_assessments` table (3 new columns)

Existing table has rich schema. We add 3 nullable columns for R2 + PDPA.

#### 2.1 Migration

```
php artisan make:migration extend_tongue_assessments_for_r2_and_pdpa
```

```php
Schema::table('tongue_assessments', function (Blueprint $table) {
    $table->string('r2_key', 500)->nullable()->after('image_url');
    $table->softDeletes();  // adds deleted_at — for PDPA soft-delete
    $table->text('consent_text')->nullable()->after('image_url');
    $table->timestamp('consented_at')->nullable()->after('consent_text');
});
```

Note: `softDeletes()` adds the `deleted_at` column and is the Laravel convention.

#### 2.2 Update `TongueAssessment` model

`backend/app/Models/TongueAssessment.php`:

```php
use Illuminate\Database\Eloquent\SoftDeletes;

class TongueAssessment extends Model {
    use SoftDeletes;
    
    protected $fillable = [
        // ... existing fillable fields,
        'r2_key', 'consent_text', 'consented_at',
    ];
    
    protected $casts = [
        // ... existing casts,
        'consented_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
```

#### 2.3 Phase 2 verification

```
php artisan migrate
php artisan tinker
>>> Schema::hasColumn('tongue_assessments', 'r2_key');       // true
>>> Schema::hasColumn('tongue_assessments', 'deleted_at');   // true
>>> Schema::hasColumn('tongue_assessments', 'consent_text'); // true
>>> $a = \App\Models\TongueAssessment::first();
>>> $a && $a->r2_key === null;                                // true (existing rows unaffected)
```

**STOP HERE.** Verify before Phase 3.

---

### Phase 3 — Add signed URL endpoints (NEW, alongside existing)

**KEY: do NOT remove or modify the existing `POST /api/patient/tongue-assessments` route. The legacy proxy upload still works for backward compat. We're adding NEW routes for the R2 path.**

#### 3.1 Add 2 methods to `TongueAssessmentController.php`

```php
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

/**
 * NEW: Issue a short-lived signed URL for direct browser → R2 upload.
 * POST /api/patient/tongue-assessments/sign-upload
 */
public function signUpload(Request $request) {
    $validated = $request->validate([
        'mime_type' => 'required|string|in:image/jpeg,image/png,image/webp',
        'size_bytes' => 'required|integer|min:1024|max:10485760',  // 1KB - 10MB
        'consent_text' => 'required|string|min:10',
    ]);

    $user = auth()->user();
    $uuid = (string) Str::uuid();
    $ext = match($validated['mime_type']) {
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    };
    $r2Key = sprintf('tongue/%d/%s/%s.%s', $user->id, $uuid, now()->timestamp, $ext);

    // Generate signed PUT URL valid for 5 minutes
    $client = Storage::disk('r2')->getClient();
    $command = $client->getCommand('PutObject', [
        'Bucket' => config('filesystems.disks.r2.bucket'),
        'Key' => $r2Key,
        'ContentType' => $validated['mime_type'],
    ]);
    $signedReq = $client->createPresignedRequest($command, '+5 minutes');

    // Pre-create the assessment row in 'pending_upload' state
    $assessment = TongueAssessment::create([
        'user_id' => $user->id,
        'r2_key' => $r2Key,
        'image_url' => null,  // filled after upload
        'status' => 'pending_upload',
        'consent_text' => $validated['consent_text'],
        'consented_at' => now(),
    ]);

    return response()->json([
        'assessment_id' => $assessment->id,
        'upload_url' => (string) $signedReq->getUri(),
        'r2_key' => $r2Key,
        'expires_at' => now()->addMinutes(5)->toIso8601String(),
    ]);
}

/**
 * NEW: Browser tells backend the upload finished. Backend verifies + queues analysis.
 * POST /api/patient/tongue-assessments/{id}/complete-upload
 */
public function completeUpload(int $id) {
    $assessment = TongueAssessment::where('id', $id)
        ->where('user_id', auth()->id())
        ->where('status', 'pending_upload')
        ->firstOrFail();

    // Verify upload actually exists in R2
    if (! Storage::disk('r2')->exists($assessment->r2_key)) {
        return response()->json(['error' => 'File not found in R2 storage'], 404);
    }

    // Update status and queue async analysis
    $assessment->update([
        'image_url' => 'r2://' . $assessment->r2_key,  // distinct prefix tells AI client to use R2 fetch
        'status' => 'processing',
    ]);

    // Async dispatch (existing job, just async instead of sync)
    \App\Jobs\AnalyzeTongueAssessment::dispatch($assessment);

    return response()->json([
        'assessment_id' => $assessment->id,
        'status' => 'processing',
    ]);
}
```

#### 3.2 Add status enum value

The existing `status` enum has `processing`, `completed`, `failed`. Add `pending_upload` to the migration that defined it (or alter via raw SQL):

```php
// In a new migration:
DB::statement("ALTER TABLE tongue_assessments MODIFY status ENUM('pending_upload','processing','completed','failed') DEFAULT 'processing'");
```

(Adjust syntax for your DB engine — MySQL syntax shown.)

#### 3.3 Add 2 routes to `routes/api.php`

In the `auth:sanctum` patient group, ADD (do not remove existing):

```php
Route::post('/patient/tongue-assessments/sign-upload', [TongueAssessmentController::class, 'signUpload']);
Route::post('/patient/tongue-assessments/{id}/complete-upload', [TongueAssessmentController::class, 'completeUpload']);
```

#### 3.4 Phase 3 verification

```bash
# Get a sanctum token for a test user, then:

# Step 1: get signed URL
curl -X POST https://your-railway.app/api/patient/tongue-assessments/sign-upload \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mime_type":"image/jpeg","size_bytes":524288,"consent_text":"I agree to terms"}'
# → returns { "assessment_id": 1, "upload_url": "https://...", ... }

# Step 2: upload a test image
curl --upload-file test.jpg "<upload_url from step 1>" \
  -H "Content-Type: image/jpeg"
# → 200 OK, no body

# Step 3: complete
curl -X POST https://your-railway.app/api/patient/tongue-assessments/1/complete-upload \
  -H "Authorization: Bearer <token>"
# → returns { "status": "processing" }

# Step 4: verify the row
php artisan tinker
>>> \App\Models\TongueAssessment::find(1);
// status='processing', r2_key='tongue/X/uuid/timestamp.jpg', image_url='r2://...'
```

**STOP HERE.** Verify before Phase 4.

---

### Phase 4 — Update AnthropicTongueClient to fetch from R2

#### 4.1 Modify `app/Services/AnthropicTongueClient.php`

Find `fetchImage(string $imageUrl)` (around line 209). Add an R2 case as the FIRST check:

```php
private function fetchImage(string $imageUrl): ?array {
    // NEW: R2-stored images use the r2:// prefix internally
    if (str_starts_with($imageUrl, 'r2://')) {
        $r2Key = substr($imageUrl, 5);
        try {
            $bytes = \Storage::disk('r2')->get($r2Key);
            $mimeType = \Storage::disk('r2')->mimeType($r2Key) ?: 'image/jpeg';
            return [
                'base64' => base64_encode($bytes),
                'media_type' => $mimeType,
            ];
        } catch (\Throwable $e) {
            \Log::error('r2_image_fetch_failed', ['key' => $r2Key, 'err' => $e->getMessage()]);
            return null;
        }
    }
    
    // ... existing code (filesystem-first then HTTP) unchanged
}
```

This change is purely additive — the existing 5-candidate filesystem fallback stays. Old assessments still work.

#### 4.2 Phase 4 verification

```
php artisan queue:work --once
# Watch the AnalyzeTongueAssessment job process assessment_id=1
# Should pull image from R2, send to Claude, get analysis, fill row.

php artisan tinker
>>> $a = \App\Models\TongueAssessment::find(1);
>>> $a->status;                  // 'completed'
>>> $a->constitution_report;     // populated array
>>> $a->raw_response;            // populated
```

**STOP HERE.** Verify before Phase 5.

---

### Phase 5 — Soft-delete + R2 cleanup on patient delete

#### 5.1 Modify `TongueAssessmentController::destroy()`

Find the existing `destroy()` method (~line 83). Replace its body:

```php
public function destroy(int $id) {
    $assessment = TongueAssessment::where('id', $id)
        ->where('user_id', auth()->id())
        ->firstOrFail();

    // Delete from R2 if applicable (legacy local-disk paths handled by GC later)
    if ($assessment->r2_key && Storage::disk('r2')->exists($assessment->r2_key)) {
        try {
            Storage::disk('r2')->delete($assessment->r2_key);
        } catch (\Throwable $e) {
            \Log::warning('r2_delete_failed', ['key' => $assessment->r2_key, 'err' => $e->getMessage()]);
            // Continue with soft-delete even if R2 delete fails
        }
    }

    // Soft-delete + scrub sensitive fields (PDPA right to erasure)
    $assessment->update([
        'image_url' => '[deleted]',
        'r2_key' => null,
        'raw_response' => null,
        'constitution_report' => null,
    ]);
    $assessment->delete();  // sets deleted_at thanks to SoftDeletes trait

    return response()->json(['status' => 'deleted']);
}
```

#### 5.2 Optional: bulk delete endpoint (PDPA "delete all my data")

Add a route + method:

```php
// routes/api.php
Route::delete('/patient/tongue-assessments', [TongueAssessmentController::class, 'destroyAll']);
```

```php
public function destroyAll() {
    $userId = auth()->id();
    $assessments = TongueAssessment::where('user_id', $userId)->get();
    foreach ($assessments as $a) {
        if ($a->r2_key && Storage::disk('r2')->exists($a->r2_key)) {
            Storage::disk('r2')->delete($a->r2_key);
        }
    }
    TongueAssessment::where('user_id', $userId)->update([
        'image_url' => '[deleted]',
        'r2_key' => null,
        'raw_response' => null,
        'constitution_report' => null,
    ]);
    TongueAssessment::where('user_id', $userId)->delete();
    return response()->json(['status' => 'all_deleted']);
}
```

#### 5.3 Phase 5 verification

```
curl -X DELETE https://your-railway.app/api/patient/tongue-assessments/1 \
  -H "Authorization: Bearer <token>"
# → {"status":"deleted"}

php artisan tinker
>>> \App\Models\TongueAssessment::withTrashed()->find(1);
// row exists, deleted_at set, raw_response=null, image_url='[deleted]', r2_key=null

>>> \Storage::disk('r2')->exists('tongue/X/uuid/timestamp.jpg');
// false — gone from R2
```

**STOP HERE.** Verify before Phase 6.

---

### Phase 6 — Frontend: Direct-to-R2 upload UI

The current v2 portal uses the legacy proxy upload. We add a NEW upload path that uses signed URLs. Both should coexist during transition.

#### 6.1 Add JS helper in `v2/assets/js/services/tongue-r2-upload.js`

```js
// HansMed tongue R2 upload — direct browser → R2 with signed URL
window.HM = window.HM || {};
HM.tongueR2Upload = (function () {
  async function uploadAndAnalyze(file, consentText) {
    // 1. Get signed URL
    const signResp = await fetch('/api/patient/tongue-assessments/sign-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + HM.auth.getToken(),
      },
      body: JSON.stringify({
        mime_type: file.type,
        size_bytes: file.size,
        consent_text: consentText,
      }),
    });
    if (! signResp.ok) throw new Error('Sign failed: ' + signResp.status);
    const sign = await signResp.json();

    // 2. Upload directly to R2
    const uploadResp = await fetch(sign.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (! uploadResp.ok) throw new Error('R2 upload failed: ' + uploadResp.status);

    // 3. Tell backend upload is done — triggers analysis
    const completeResp = await fetch(`/api/patient/tongue-assessments/${sign.assessment_id}/complete-upload`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + HM.auth.getToken() },
    });
    if (! completeResp.ok) throw new Error('Complete failed: ' + completeResp.status);

    return { assessment_id: sign.assessment_id, status: 'processing' };
  }

  return { uploadAndAnalyze };
})();
```

#### 6.2 Wire upload UI in patient panel

Find the existing tongue upload UI (likely in `v2/assets/js/panels/patient/ai-diagnosis.js` or similar). Replace the old multipart form submission with:

```js
async function onConfirmUpload() {
  const file = HM.fileInput.files[0];
  const consentChecked = document.getElementById('tongue-consent').checked;
  const consentText = document.getElementById('tongue-consent').dataset.consentText;
  
  if (! consentChecked) {
    alert('Please agree to image storage and analysis before continuing.');
    return;
  }
  
  HM.showSpinner('Uploading...');
  try {
    const result = await HM.tongueR2Upload.uploadAndAnalyze(file, consentText);
    HM.showSpinner('Analyzing...');
    pollForResult(result.assessment_id);  // see Phase 7
  } catch (err) {
    HM.hideSpinner();
    alert('Upload failed: ' + err.message);
  }
}
```

---

### Phase 7 — Frontend: Result polling + display

The existing GET endpoint `/api/patient/tongue-assessments/{id}` already returns the full assessment. Just poll until `status === 'completed'`.

```js
function pollForResult(assessmentId, attempts = 0) {
  if (attempts > 20) {  // 60 sec max (3s × 20)
    HM.hideSpinner();
    alert('Analysis is taking longer than expected. Refresh later.');
    return;
  }
  setTimeout(async () => {
    const resp = await fetch(`/api/patient/tongue-assessments/${assessmentId}`, {
      headers: { 'Authorization': 'Bearer ' + HM.auth.getToken() },
    });
    const data = await resp.json();
    if (data.status === 'completed') {
      HM.hideSpinner();
      // Render via existing constitution-card component
      const html = HM.constitutionCard.renderFull({
        ...data,
        tongue_constitution: {
          name_en: data.tongue_color + ' tongue',
          name_zh: data.constitution_report?.tongue_summary_zh,
          confidence: data.health_score / 100,
        },
      });
      document.getElementById('tongue-result').innerHTML = html;
    } else if (data.status === 'failed') {
      HM.hideSpinner();
      alert('Analysis failed. Please try again or contact support.');
    } else {
      pollForResult(assessmentId, attempts + 1);
    }
  }, 3000);
}
```

---

### Phase 8 — Privacy policy + consent UI

#### 8.1 Create or update `v3/privacy.html` (if exists) or `v2/privacy.html`

Add a section:

```html
<h2>Tongue Images & AI Analysis</h2>
<p>When you upload a tongue image for AI Wellness Assessment, the image is
stored on encrypted Cloudflare R2 storage. We retain your image indefinitely
as part of your medical record, accessible only to you and your assigned
licensed practitioner.</p>

<p>You may request deletion of any tongue image at any time from your account
&rarr; <strong>My Wellness Records &rarr; Delete</strong>. Deletion is
permanent and removes both the image and any derived AI analysis.</p>

<p>AI analysis is performed by Anthropic Claude (a US-based AI service). Only
the image and a clinical prompt are sent. No personally identifying
information accompanies the AI request. As Anthropic is US-based, your image
data crosses Malaysian borders during analysis. By submitting an image, you
consent to this cross-border data transfer under PDPA Section 8.</p>
```

#### 8.2 Consent checkbox before upload

In the upload UI:

```html
<label class="consent-row">
  <input type="checkbox" id="tongue-consent" 
         data-consent-text="I agree that my tongue image will be stored securely and analyzed by AI for wellness assessment purposes. I can delete this image at any time from my account settings.">
  I agree that my tongue image will be stored securely and analyzed by AI
  for wellness assessment purposes. I can delete this image at any time
  from my account settings.
</label>
```

The `data-consent-text` is what gets sent to the backend in the
`consent_text` field — this captures the EXACT wording the user agreed to
(important for legal audit if disputed later).

#### 8.3 "My Wellness Records" delete UI

Add to patient panel:
- List of past assessments (already exists from `GET /api/patient/tongue-assessments`)
- For each row, add a "Delete" button that calls the modified DELETE endpoint
- Confirmation modal: "This will permanently delete the image and analysis. This cannot be undone."

---

### Phase 9 — Smoke test (E2E)

1. Log in as test patient
2. Navigate to AI Wellness Assessment
3. Check the consent checkbox
4. Upload a tongue image (use sample from `v2/test-data/sample-tongue.jpg` if exists, else any JPG)
5. Verify upload succeeds (no CORS error, no 4xx/5xx in DevTools Network tab)
6. Verify the upload goes directly to `*.r2.cloudflarestorage.com` (NOT to your Railway URL)
7. Wait ~10-30 seconds for analysis
8. Verify constitution card renders with the AI result
9. Go to "My Wellness Records" → click Delete on the assessment
10. Verify image is deleted from R2 (check Cloudflare R2 dashboard — bucket should be empty or not contain that key)
11. Verify row is soft-deleted: `php artisan tinker` → `\App\Models\TongueAssessment::withTrashed()->find($id)` → `deleted_at` is set, `raw_response` is null
12. Verify the deleted assessment NO LONGER appears in `GET /api/patient/tongue-assessments`

---

## Acceptance criteria

- [ ] Patient uploads a tongue image directly to R2 (no Laravel proxy)
- [ ] Image lands in R2 bucket at `tongue/{user_id}/{uuid}/{timestamp}.{ext}`
- [ ] AI analysis runs within 30 seconds, populates `constitution_report` + flat fields
- [ ] Result renders in constitution card
- [ ] Patient can delete an assessment from their account
- [ ] Soft-delete preserves audit trail (`deleted_at` set, sensitive fields scrubbed)
- [ ] Image is removed from R2 on deletion
- [ ] Privacy policy discloses retention + deletion right + cross-border AI transfer
- [ ] Consent text is captured at upload time in `consent_text` column
- [ ] **Existing legacy upload path still works** (backward-compat for v2 patients mid-flight)
- [ ] No tongue image is publicly accessible (signed URLs only, bucket private)

## Cost expectations (per 1000 patients × 1 assessment each)

- R2 storage: ~500MB total = $0.0075/month (well within 10GB free tier)
- R2 egress to Laravel for AI: $0 (R2 has $0 egress!)
- Claude Sonnet 4.5 vision: ~$10-15 total
- **Total: ~$10-15 per 1000 analyses.**

## Compliance notes

- ✅ **PDPA Section 8 (cross-border transfer):** Disclosed in privacy policy + captured in consent text
- ✅ **PDPA right of erasure:** Implemented via soft-delete + R2 cleanup
- ✅ **Audit trail:** `deleted_at` + `consented_at` + `consent_text` columns preserve who agreed to what when
- ⚠️ **Future:** Add practitioner audit log (who viewed which image when) — follow-up Brief #22
- ⚠️ **Future:** Consider adding `consent_version` column if privacy policy text changes — Brief #23

## Risks + rollback

**If Phase 4 (AnthropicTongueClient R2 fetch) breaks existing flow:**
- The new `r2://` prefix check is FIRST in `fetchImage()`. If it returns null, the existing 5-candidate fallback runs. Existing assessments unaffected.
- Rollback: revert the single `if (str_starts_with(...))` block. Existing analysis still works.

**If Phase 5 (soft-delete) breaks doctor review queue:**
- The `SoftDeletes` trait causes `Model::all()` and similar queries to exclude soft-deleted rows BY DEFAULT.
- Doctor review queue queries that previously saw all rows will now exclude deleted ones. **This is the desired behavior** (deleted means gone for everyone).
- If you need to view soft-deleted in admin, use `withTrashed()`.

**Full rollback:**
```
git revert <commits>
php artisan migrate:rollback --step=2  # rolls back the 2 new migrations
```
Existing local-disk uploads continue to work.

## Migration strategy for existing assessments

If there are existing tongue assessments with local-disk `image_url`s (e.g.,
`/api/uploads/tongue/...`), they keep working unchanged because:
- AnthropicTongueClient still has filesystem fallback
- Their `r2_key` is null
- Their existing flow doesn't touch R2

For soft launch with no real patients yet, this is fine. We can write a
follow-up migration brief (#24) to bulk-move them to R2 if needed.

## Follow-up briefs (NOT in this brief)

- Brief #22 — Practitioner audit log (who viewed which patient image when)
- Brief #23 — Privacy policy versioning + consent_version tracking
- Brief #24 — Migrate any existing local-disk tongue images to R2
- Brief #25 — Image quality pre-check (reject blurry images before AI to save cost)
