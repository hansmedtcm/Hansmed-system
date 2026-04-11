<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Prescription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrescriptionOversightController extends Controller
{
    // M-06: platform-wide prescription inspection
    public function index(Request $request)
    {
        $q = Prescription::query()->with(['items', 'doctor.doctorProfile', 'patient.patientProfile']);

        if ($s = $request->query('status'))      $q->where('status', $s);
        if ($d = $request->query('doctor_id'))   $q->where('doctor_id', $d);
        if ($p = $request->query('patient_id'))  $q->where('patient_id', $p);
        if ($drug = $request->query('drug')) {
            $q->whereHas('items', fn($w) => $w->where('drug_name', 'like', "%{$drug}%"));
        }

        return response()->json($q->orderByDesc('created_at')->paginate(30));
    }

    public function show(int $id)
    {
        $rx = Prescription::with(['items', 'doctor.doctorProfile', 'patient.patientProfile', 'parent'])
            ->findOrFail($id);
        return response()->json(['prescription' => $rx]);
    }

    // Admin can force-revoke problematic prescriptions
    public function forceRevoke(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $rx = Prescription::findOrFail($id);

        return DB::transaction(function () use ($rx, $data, $request) {
            $rx->update(['status' => 'revoked']);
            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'prescription.force_revoke',
                'target_type' => 'prescription',
                'target_id'   => $rx->id,
                'payload'     => json_encode(['reason' => $data['reason']]),
                'created_at'  => now(),
            ]);
            return response()->json(['prescription' => $rx->fresh()]);
        });
    }
}
