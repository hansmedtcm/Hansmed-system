<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $q = Appointment::query();

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($date = $request->query('date')) {
            $q->whereDate('scheduled_start', $date);
        }
        if ($doctorId = $request->query('doctor_id')) {
            $q->where('doctor_id', $doctorId);
        }

        return response()->json(
            $q->orderByDesc('scheduled_start')->paginate(30)
        );
    }
}
