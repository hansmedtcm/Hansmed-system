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

    // Admin creates an appointment on behalf of a patient (walk-in or online).
    public function store(Request $request)
    {
        $data = $request->validate([
            'patient_id'      => ['required', 'integer', 'exists:users,id'],
            'doctor_id'       => ['nullable', 'integer', 'exists:users,id'],
            'scheduled_start' => ['required', 'date'],
            'scheduled_end'   => ['required', 'date', 'after:scheduled_start'],
            'fee'             => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            'concern_label'   => ['nullable', 'string', 'max:120'],
            'visit_type'      => ['nullable', 'in:online,walk_in'],
        ]);

        $appt = Appointment::create([
            'patient_id'      => $data['patient_id'],
            'doctor_id'       => $data['doctor_id'] ?? null,
            'scheduled_start' => $data['scheduled_start'],
            'scheduled_end'   => $data['scheduled_end'],
            'status'          => 'confirmed',
            'fee'             => $data['fee'] ?? 0,
            'notes'           => $data['notes'] ?? null,
            'concern_label'   => $data['concern_label'] ?? null,
            'is_pool'         => empty($data['doctor_id']) ? 1 : 0,
            'visit_type'      => $data['visit_type'] ?? 'walk_in',
        ]);

        return response()->json(['appointment' => $appt], 201);
    }
}
