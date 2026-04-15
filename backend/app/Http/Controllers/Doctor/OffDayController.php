<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Doctor off-days — ad-hoc day-off list on top of the weekly schedule.
 * Stored as a JSON array of YYYY-MM-DD strings on doctor_profiles.off_days.
 */
class OffDayController extends Controller
{
    public function index(Request $request)
    {
        $row = DB::table('doctor_profiles')
            ->where('user_id', $request->user()->id)
            ->first();
        if (! $row) return response()->json(['data' => []]);
        $off = [];
        if (property_exists($row, 'off_days') && $row->off_days) {
            $decoded = json_decode($row->off_days, true);
            if (is_array($decoded)) $off = $decoded;
        }
        return response()->json(['data' => array_values($off)]);
    }

    // POST /doctor/off-days  body: { date: YYYY-MM-DD }
    public function toggle(Request $request)
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        $userId = $request->user()->id;
        $row = DB::table('doctor_profiles')->where('user_id', $userId)->first();
        if (! $row) return response()->json(['message' => 'Profile not found'], 404);

        $off = [];
        if (property_exists($row, 'off_days') && $row->off_days) {
            $decoded = json_decode($row->off_days, true);
            if (is_array($decoded)) $off = $decoded;
        }

        $idx = array_search($data['date'], $off, true);
        if ($idx === false) {
            $off[] = $data['date'];
            $action = 'added';
        } else {
            array_splice($off, $idx, 1);
            $action = 'removed';
        }

        DB::table('doctor_profiles')
            ->where('user_id', $userId)
            ->update(['off_days' => json_encode(array_values($off))]);

        return response()->json([
            'action' => $action,
            'date'   => $data['date'],
            'data'   => array_values($off),
        ]);
    }
}
