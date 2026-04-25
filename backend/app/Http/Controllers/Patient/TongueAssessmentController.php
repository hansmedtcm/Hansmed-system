<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeTongueAssessment;
use App\Models\TongueAssessment;
use App\Services\TongueAssessment\KnowledgeBase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
}

/* Class alias so older route definitions or queue payloads referring
 * to the old class name keep working through one release cycle. */
class_alias(TongueAssessmentController::class, 'App\\Http\\Controllers\\Patient\\TongueDiagnosisController');
