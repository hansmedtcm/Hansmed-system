<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduleController extends Controller
{
    public function index(Request $request)
    {
        $schedules = DB::table('doctor_schedules')
            ->where('doctor_id', $request->user()->id)
            ->orderBy('weekday')
            ->orderBy('start_time')
            ->get();
        return response()->json(['schedules' => $schedules]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'weekday'      => ['required', 'integer', 'between:0,6'],
            'start_time'   => ['required', 'date_format:H:i'],
            'end_time'     => ['required', 'date_format:H:i', 'after:start_time'],
            'slot_minutes' => ['nullable', 'integer', 'in:15,20,30,45,60'],
        ]);

        $id = DB::table('doctor_schedules')->insertGetId([
            'doctor_id'    => $request->user()->id,
            'weekday'      => $data['weekday'],
            'start_time'   => $data['start_time'],
            'end_time'     => $data['end_time'],
            'slot_minutes' => $data['slot_minutes'] ?? 30,
            'is_active'    => true,
        ]);

        return response()->json(['schedule' => DB::table('doctor_schedules')->find($id)], 201);
    }

    public function destroy(Request $request, int $id)
    {
        DB::table('doctor_schedules')
            ->where('id', $id)
            ->where('doctor_id', $request->user()->id)
            ->delete();
        return response()->json(['ok' => true]);
    }

    /** Get available slots for a doctor on a given date (public for patient booking) */
    public function availableSlots(Request $request, int $doctorId)
    {
        $date = $request->query('date', now()->toDateString());
        $dayOfWeek = (int) date('w', strtotime($date)); // 0=Sun

        $schedules = DB::table('doctor_schedules')
            ->where('doctor_id', $doctorId)
            ->where('weekday', $dayOfWeek)
            ->where('is_active', true)
            ->get();

        $slots = [];
        foreach ($schedules as $sch) {
            $start = strtotime($date . ' ' . $sch->start_time);
            $end = strtotime($date . ' ' . $sch->end_time);
            $step = $sch->slot_minutes * 60;

            for ($t = $start; $t < $end; $t += $step) {
                $slotStart = date('Y-m-d\TH:i:s', $t);
                $slotEnd = date('Y-m-d\TH:i:s', $t + $step);

                // Check if already booked
                $booked = DB::table('appointments')
                    ->where('doctor_id', $doctorId)
                    ->whereNotIn('status', ['cancelled', 'no_show'])
                    ->where('scheduled_start', '<', $slotEnd)
                    ->where('scheduled_end', '>', $slotStart)
                    ->exists();

                $slots[] = [
                    'start'    => $slotStart,
                    'end'      => $slotEnd,
                    'time'     => date('h:i A', $t),
                    'available'=> !$booked,
                ];
            }
        }

        return response()->json(['date' => $date, 'slots' => $slots]);
    }
}
