<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Doctor constitution-review queue for AI-diagnosis questionnaires.
 *
 * Patients submit their 10-dimension report via POST /patient/questionnaires.
 * The payload is saved inside the `symptoms` JSON column of the questionnaires
 * table (tagged kind = "ai_constitution_v2", review_status = "pending").
 *
 * The doctor lists pending reports here, opens one, edits the AI-generated
 * advice template (herbs / foods / avoid / tips), adds a comment, and
 * approves. Approved reports then show the doctor's advice to the patient.
 */
class ConstitutionReviewController extends Controller
{
    // GET /doctor/constitution-reviews?filter=pending|mine|all
    public function index(Request $request)
    {
        $filter = $request->query('filter', 'pending');

        $rows = DB::table('questionnaires')
            ->select(
                'questionnaires.id',
                'questionnaires.patient_id',
                'questionnaires.symptoms',
                'questionnaires.created_at',
                'users.email as patient_email',
            )
            ->leftJoin('users', 'users.id', '=', 'questionnaires.patient_id')
            ->orderByDesc('questionnaires.created_at')
            ->limit(200)
            ->get();

        $me = $request->user()->id;
        $out = [];
        foreach ($rows as $row) {
            $s = json_decode($row->symptoms ?? '{}', true) ?: [];
            if (($s['kind'] ?? '') !== 'ai_constitution_v2') continue;

            $status = $s['review_status'] ?? 'pending';
            $reviewed_by = $s['reviewed_by'] ?? null;

            if ($filter === 'pending' && $status !== 'pending') continue;
            if ($filter === 'mine' && (int) $reviewed_by !== $me)  continue;

            $out[] = [
                'id'              => $row->id,
                'patient_id'      => $row->patient_id,
                'patient_email'   => $row->patient_email,
                'created_at'      => $row->created_at,
                'review_status'   => $status,
                'reviewed_by'     => $reviewed_by,
                'reviewed_at'     => $s['reviewed_at'] ?? null,
                'patterns'        => $s['patterns'] ?? [],
                'safety_alerts'   => $s['safety_alerts'] ?? [],
            ];
        }

        return response()->json(['data' => $out]);
    }

    // GET /doctor/constitution-reviews/{id}
    public function show(int $id)
    {
        $row = DB::table('questionnaires')
            ->select('questionnaires.*', 'users.email as patient_email')
            ->leftJoin('users', 'users.id', '=', 'questionnaires.patient_id')
            ->where('questionnaires.id', $id)
            ->first();

        if (! $row) return response()->json(['message' => 'Not found'], 404);
        $s = json_decode($row->symptoms ?? '{}', true) ?: [];
        if (($s['kind'] ?? '') !== 'ai_constitution_v2') {
            return response()->json(['message' => 'Not an AI constitution questionnaire'], 422);
        }

        return response()->json([
            'questionnaire' => [
                'id'            => $row->id,
                'patient_id'    => $row->patient_id,
                'patient_email' => $row->patient_email,
                'created_at'    => $row->created_at,
                'report'        => $s,
            ],
        ]);
    }

    // POST /doctor/constitution-reviews/{id}/review
    //   body: { decision: approved|needs_changes, doctor_comment, advice: {...} }
    public function review(Request $request, int $id)
    {
        $data = $request->validate([
            'decision'       => ['required', 'in:approved,needs_changes'],
            'doctor_comment' => ['nullable', 'string', 'max:4000'],
            'advice'         => ['nullable', 'array'],
            // advice structure: { herbs: [], foods: [], avoid: string, tips: [] }
        ]);

        $row = DB::table('questionnaires')->where('id', $id)->first();
        if (! $row) return response()->json(['message' => 'Not found'], 404);

        $s = json_decode($row->symptoms ?? '{}', true) ?: [];
        $s['review_status']  = $data['decision'];
        $s['doctor_comment'] = $data['doctor_comment'] ?? null;
        $s['doctor_advice']  = $data['advice'] ?? [];
        $s['reviewed_by']    = $request->user()->id;
        $s['reviewed_at']    = now()->toIso8601String();

        DB::table('questionnaires')
            ->where('id', $id)
            ->update(['symptoms' => json_encode($s)]);

        return response()->json([
            'questionnaire' => [
                'id'     => $id,
                'report' => $s,
            ],
        ]);
    }
}
