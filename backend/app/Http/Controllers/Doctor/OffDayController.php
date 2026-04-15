<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Doctor day-overrides — ad-hoc adjustments on top of the weekly schedule.
 * Stored as JSON on doctor_profiles.off_days. Two kinds of entries:
 *   - full-day off:  { date: 'YYYY-MM-DD', type: 'off' }
 *   - custom hours:  { date: 'YYYY-MM-DD', type: 'custom', start: 'HH:MM', end: 'HH:MM' }
 *
 * Legacy payload (plain 'YYYY-MM-DD' strings) is auto-upgraded on read.
 */
class OffDayController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(['data' => $this->loadList($request->user()->id)]);
    }

    // POST /doctor/off-days
    //   body: { date: YYYY-MM-DD, type?: 'off'|'custom'|'clear', start?, end? }
    //   - type 'off'    → mark full-day off
    //   - type 'custom' → set custom working hours
    //   - type 'clear'  → remove the override (restore weekly pattern)
    //   - no type       → toggle off (backward-compatible)
    public function toggle(Request $request)
    {
        $data = $request->validate([
            'date'  => ['required', 'date_format:Y-m-d'],
            'type'  => ['nullable', 'in:off,custom,clear'],
            'start' => ['nullable', 'date_format:H:i'],
            'end'   => ['nullable', 'date_format:H:i'],
        ]);

        $userId = $request->user()->id;
        $list = $this->loadList($userId);
        $date = $data['date'];

        // Remove any existing entry for this date
        $list = array_values(array_filter($list, function ($e) use ($date) {
            return ($e['date'] ?? null) !== $date;
        }));

        $action = 'cleared';
        $type = $data['type'] ?? null;

        if ($type === null) {
            // Legacy behaviour: if not present, add as full-day off.
            $list[] = ['date' => $date, 'type' => 'off'];
            $action = 'added';
        } elseif ($type === 'off') {
            $list[] = ['date' => $date, 'type' => 'off'];
            $action = 'off';
        } elseif ($type === 'custom') {
            if (empty($data['start']) || empty($data['end'])) {
                return response()->json(['message' => 'start and end required for custom hours'], 422);
            }
            if ($data['start'] >= $data['end']) {
                return response()->json(['message' => 'start must be before end'], 422);
            }
            $list[] = [
                'date'  => $date,
                'type'  => 'custom',
                'start' => $data['start'],
                'end'   => $data['end'],
            ];
            $action = 'custom';
        } // 'clear' leaves the list without a match = removed above

        DB::table('doctor_profiles')
            ->where('user_id', $userId)
            ->update(['off_days' => json_encode($list)]);

        return response()->json([
            'action' => $action,
            'date'   => $date,
            'data'   => $list,
        ]);
    }

    /** Normalise stored JSON into an array of {date, type, [start], [end]} objects. */
    private function loadList(int $userId): array
    {
        $row = DB::table('doctor_profiles')->where('user_id', $userId)->first();
        if (! $row || ! property_exists($row, 'off_days') || ! $row->off_days) return [];

        $decoded = json_decode($row->off_days, true);
        if (! is_array($decoded)) return [];

        $out = [];
        foreach ($decoded as $entry) {
            if (is_string($entry)) {
                // Legacy plain date string — treat as full-day off.
                $out[] = ['date' => $entry, 'type' => 'off'];
            } elseif (is_array($entry) && isset($entry['date'])) {
                $out[] = [
                    'date'  => $entry['date'],
                    'type'  => $entry['type'] ?? 'off',
                    'start' => $entry['start'] ?? null,
                    'end'   => $entry['end'] ?? null,
                ];
            }
        }
        return $out;
    }
}
