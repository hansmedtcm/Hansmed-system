<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\TongueAssessment;
use App\Services\NotificationService;
use Illuminate\Http\Request;

/**
 * Doctor Tongue Diagnosis review queue.
 *
 * Workflow:
 *   1. Patient uploads tongue photo (Patient\TongueAssessmentController).
 *   2. Analysis completes, AI writes result into constitution_report.
 *      review_status starts as 'pending'.
 *   3. Doctor sees the entry in this queue.
 *   4. Doctor reviews, optionally edits medicine_suggestions, and approves
 *      (or requests changes). Comment + reviewer id saved.
 *   5. Patient sees the approval status + doctor comment on their report.
 */
class TongueReviewController extends Controller
{
    public function __construct(private NotificationService $notify) {}

    // GET /doctor/tongue-reviews?filter=pending|recent|all
    public function index(Request $request)
    {
        // 2026-05-13 fast-path — try/catch, ORDER BY id (primary key,
        // no sort overhead), limit 10. If anything fails return empty
        // queue instead of hanging the request.
        try {
            $filter = $request->query('filter', 'pending');
            $q = TongueAssessment::query()
                ->with(['patient:id,role', 'patient.patientProfile'])
                ->orderByDesc('id');
            if ($filter === 'pending') {
                $q->where('review_status', 'pending')
                  ->whereIn('status', ['completed', 'uploaded']);
            } elseif ($filter === 'mine') {
                $q->where('reviewed_by', $request->user()->id);
            }
            return response()->json(['data' => $q->limit(10)->get()]);
        } catch (\Throwable $e) {
            \Log::warning('TongueReviewController::index fast-failed: ' . $e->getMessage());
            return response()->json(['data' => []]);
        }
    }

    // GET /doctor/tongue-reviews/{id}
    public function show(int $id)
    {
        $d = TongueAssessment::with('patient:id,email')->findOrFail($id);
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

        $d = TongueAssessment::findOrFail($id);
        $d->review_status        = $data['decision'];
        $d->doctor_comment       = $data['comment'] ?? null;
        $d->medicine_suggestions = $data['medicine_suggestions'] ?? [];
        $d->reviewed_by          = $request->user()->id;
        $d->reviewed_at          = now();
        $d->save();

        // Notify the patient — both "approved" and "needs_changes" fire.
        $this->notify->tongueReviewed((int) $d->patient_id, (int) $d->id, $data['decision']);

        return response()->json(['diagnosis' => $d]);
    }
}
