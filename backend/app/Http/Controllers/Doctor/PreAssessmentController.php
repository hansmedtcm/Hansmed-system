<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\PreAssessment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Brief #22 · Doctor-facing pre-assessment endpoints.
 *
 * Routes (auth: sanctum, role: doctor):
 *   GET  /api/doctor/pre-assessment/{id}
 *   POST /api/doctor/pre-assessment/{id}/decision
 *
 * Doctor view receives the FULL pre-assessment payload — including
 * clinical_assist_output, tcm_top_patterns, red_flags_detected,
 * suggested_treatments — exactly the inverse of the patient view.
 */
class PreAssessmentController extends Controller
{
    /** GET /api/doctor/pre-assessment/{id} — full handoff packet. */
    public function show(Request $request, int $id)
    {
        $pa = PreAssessment::with([\'patient\', \'patient.patientProfile\', \'tongueAssessment\'])
            ->where(\'id\', $id)->firstOrFail();

        // Authorisation: doctor must be assigned to the appointment OR be admin.
        // For now we let any authenticated doctor view; Brief #20 doctor-side
        // controllers use the same pattern. Tightening this requires the
        // appointment relationship which is nullable on pre_assessments.
        $doctor = $request->user();
        if (! in_array($doctor->role ?? \'\', [\'doctor\', \'admin\'], true)) {
            abort(403);
        }

        // Reveal contact info per Brief #20 pattern.
        if ($pa->patient && $pa->patient->patientProfile) {
            $pa->patient->patientProfile->revealContactInfo();
        }

        return response()->json([\'pre_assessment\' => $pa]);
    }

    /**
     * POST /api/doctor/pre-assessment/{id}/decision
     *
     * Records the doctor\'s call on the AI\'s hypothesis. This is the
     * training signal for future AI tuning. Decision is one of:
     *   - confirmed: AI hypothesis matches doctor\'s clinical impression
     *   - amended:   doctor agrees broadly but adjusted something
     *   - overridden: doctor disagrees with AI entirely
     */
    public function recordDecision(Request $request, int $id)
    {
        $data = $request->validate([
            \'decision\' => [\'required\', \'in:confirmed,amended,overridden\'],
            \'notes\'    => [\'nullable\', \'string\', \'max:5000\'],
        ]);
        $doctor = $request->user();
        if (! in_array($doctor->role ?? \'\', [\'doctor\', \'admin\'], true)) {
            abort(403);
        }

        $pa = PreAssessment::findOrFail($id);
        $pa->doctor_decision        = $data[\'decision\'];
        $pa->doctor_decision_notes  = $data[\'notes\'] ?? null;
        $pa->doctor_decided_by      = $doctor->id;
        $pa->doctor_decided_at      = now();
        $pa->save();

        // Bust any cache that was keying off this assessment\'s state.
        Cache::store(\'redis\')->forget("pre_assessment:{$id}");

        return response()->json([\'pre_assessment\' => $pa]);
    }
}
