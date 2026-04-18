<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeTongueDiagnosis;
use App\Models\TongueDiagnosis;
use App\Services\TongueDiagnosis\KnowledgeBase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TongueDiagnosisController extends Controller
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

        $diag = TongueDiagnosis::create([
            'patient_id' => $request->user()->id,
            'image_url'  => $url,
            'status'     => 'processing',
        ]);

        try {
            // dispatchSync runs the job inline in this request — no queue
            // worker required. If the AI provider errors out, the job's
            // handle() still writes status=failed via $diag->fill()->save()
            // so the patient sees a clean error instead of an indefinite spinner.
            AnalyzeTongueDiagnosis::dispatchSync($diag->id);
        } catch (\Throwable $e) {
            \Log::error('tongue_analysis_sync_failed', ['id' => $diag->id, 'err' => $e->getMessage()]);
            TongueDiagnosis::where('id', $diag->id)->update([
                'status' => 'failed',
            ]);
        }

        return response()->json(['diagnosis' => $diag->fresh()], 202);
    }

    // C-07: history
    public function index(Request $request)
    {
        return response()->json(
            TongueDiagnosis::where('patient_id', $request->user()->id)
                ->orderByDesc('created_at')
                ->paginate(20)
        );
    }

    public function show(Request $request, int $id)
    {
        $diag = TongueDiagnosis::where('patient_id', $request->user()->id)->findOrFail($id);
        return response()->json(['diagnosis' => $diag]);
    }

    public function destroy(Request $request, int $id)
    {
        TongueDiagnosis::where('patient_id', $request->user()->id)->findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }

    // C-05/C-06: tongue knowledge reference (public glossary)
    public function knowledgeBase()
    {
        return response()->json(KnowledgeBase::getFullSchema());
    }
}
