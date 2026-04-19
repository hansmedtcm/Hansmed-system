<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuestionnaireController extends Controller
{
    public function __construct(private NotificationService $notifier) {}

    public function store(Request $request)
    {
        $data = $request->validate([
            'symptoms'         => ['nullable'],
            'lifestyle'        => ['nullable'],
            'diet'             => ['nullable'],
            'discomfort_areas' => ['nullable'],
        ]);

        $id = DB::table('questionnaires')->insertGetId([
            'patient_id'      => $request->user()->id,
            'symptoms'        => json_encode($data['symptoms'] ?? []),
            'lifestyle'       => json_encode($data['lifestyle'] ?? []),
            'diet'             => json_encode($data['diet'] ?? []),
            'discomfort_areas' => json_encode($data['discomfort_areas'] ?? []),
            'created_at'      => now(),
        ]);

        // Notify every approved doctor that a new constitution
        // report is sitting in the review pool — frontend plays the
        // "review" sound cue on these.
        $this->notifier->reviewPendingForDoctors('constitution', (int) $id, (int) $request->user()->id);

        return response()->json(['questionnaire' => DB::table('questionnaires')->find($id)], 201);
    }

    public function index(Request $request)
    {
        $list = DB::table('questionnaires')
            ->where('patient_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate(20);
        return response()->json($list);
    }

    public function show(Request $request, int $id)
    {
        $row = DB::table('questionnaires')
            ->where('id', $id)
            ->where('patient_id', $request->user()->id)
            ->first();
        if (! $row) return response()->json(['message' => 'Not found'], 404);
        return response()->json(['questionnaire' => $row]);
    }
}
