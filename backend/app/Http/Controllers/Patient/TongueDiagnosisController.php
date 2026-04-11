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
    // C-04: upload tongue image and queue analysis
    public function store(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:8192'],
        ]);

        $path = $request->file('image')->store('tongue', 'public');
        $url  = Storage::disk('public')->url($path);

        $diag = TongueDiagnosis::create([
            'patient_id' => $request->user()->id,
            'image_url'  => $url,
            'status'     => 'processing',
        ]);

        AnalyzeTongueDiagnosis::dispatch($diag->id);

        return response()->json(['diagnosis' => $diag], 202);
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
