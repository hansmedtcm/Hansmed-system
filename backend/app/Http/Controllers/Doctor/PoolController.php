<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;

/**
 * Pool controller — handles the patient pool that doctors pick from.
 *
 * Flow:
 *   1. Patient books via Patient\AppointmentController::store() without a
 *      doctor_id. Appointment is created with doctor_id=null, status='confirmed',
 *      is_pool=1.
 *   2. Doctor views GET /doctor/pool to see unclaimed pool appointments.
 *   3. Doctor claims one via POST /doctor/pool/{id}/pick → doctor_id set,
 *      is_pool flipped off.
 *   4. From there the normal doctor consult flow takes over.
 */
class PoolController extends Controller
{
    // GET /doctor/pool?date=YYYY-MM-DD
    public function index(Request $request)
    {
        $date = $request->query('date');
        $q = Appointment::query()
            ->with(['patient.patientProfile'])
            ->whereNull('doctor_id')
            ->where('is_pool', 1)
            ->whereNotIn('status', ['cancelled', 'completed', 'no_show'])
            ->orderBy('scheduled_start', 'asc');

        if ($date) {
            $q->whereDate('scheduled_start', $date);
        }
        return response()->json(['data' => $q->get()]);
    }

    // POST /doctor/pool/{id}/pick
    public function pick(Request $request, int $id)
    {
        $appt = Appointment::findOrFail($id);
        if ($appt->doctor_id) {
            return response()->json(['message' => 'Already claimed'], 409);
        }
        $appt->doctor_id = $request->user()->id;
        $appt->is_pool = 0;
        if (! in_array($appt->status, ['in_progress', 'completed'], true)) {
            $appt->status = 'confirmed';
        }
        $appt->save();
        return response()->json(['appointment' => $appt]);
    }
}
