<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\TongueDiagnosis;
use Illuminate\Http\Request;

/**
 * Doctor Tongue Diagnosis review queue.
 *
 * Workflow:
 *   1. Patient uploads tongue photo (Patient\TongueDiagnosisController).
 *   2. Analysis completes, AI writes result into constitution_report.
 *      review_status starts as 'pending'.
 *   3. Doctor sees the entry in this queue.
 *   4. Doctor reviews, optionally edits medicine_suggestions, and approves
 *      (or requests changes). Comment + reviewer id saved.
 *   5. Patient sees the approval status + doctor comment on their report.
 */
class TongueReviewController extends Controller
{
    // GET /doctor/tongue-reviews?filter=pending|recent|all
    public function index(Request $request)
    {
        $filter = $request->query('filter', 'pending');
        $q = TongueDiagnosis::query()
            ->with('patient:id,email,role')
            ->orderByDesc('created_at');

        if ($filter === 'pending') {
            $q->where('review_status', 'pending')
              ->whereIn('status', ['completed', 'uploaded']); // only reviewable ones
        } elseif ($filter === 'mine') {
            $q->where('reviewed_by', $request->user()->id);
        } // 'all' → no extra filter

        return response()->json(['data' => $q->limit(100)->get()]);
    }

    // GET /doctor/tongue-reviews/{id}
    public function show(int $id)
    {
        $d = TongueDiagnosis::with('patient:id,email')->findOrFail($id);
        return response()->json(['diagnosis' => $d]);
    }

    // POST /doctor/tongue-reviews/{id}/review
    //   body: { decision: approved|needs_changes, comment: string, medicine_suggestions: array }
    public function review(Request $request, int $id)
    {
        $data = $request->validate([
            'decision'             => ['required', 'in:approved,needs_changes'],
            'comment'              => ['nullable', 'string', 'max:4000'],
            'medicine_suggestions' => ['nullable', 'array'],
            'medicine_suggestions.*.name'   => ['nullable', 'string', 'max:120'],
            'medicine_suggestions.*.name_zh'=> ['nullable', 'string', 'max:120'],
            'medicine_suggestions.*.note'   => ['nullable', 'string', 'max:500'],
        ]);

        $d = TongueDiagnosis::findOrFail($id);
        $d->review_status        = $data['decision'];
        $d->doctor_comment       = $data['comment'] ?? null;
        $d->medicine_suggestions = $data['medicine_suggestions'] ?? [];
        $d->reviewed_by          = $request->user()->id;
        $d->reviewed_at          = now();
        $d->save();

        return response()->json(['diagnosis' => $d]);
    }
}
