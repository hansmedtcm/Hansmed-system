<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Returns "unread" / "pending" counts per sidebar tab for the current user.
 * Each role gets a different set of keys; the frontend (HM.badges) decides
 * which keys to map to which sidebar route.
 */
class BadgeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user->role;

        $counts = [
            // Common to all roles
            'notifications' => $this->safeCount(function () use ($user) {
                return DB::table('notifications')
                    ->where('user_id', $user->id)
                    ->whereNull('read_at')
                    ->count();
            }),
        ];

        if ($role === 'patient') {
            $counts = array_merge($counts, $this->patientCounts($user->id));
        } elseif ($role === 'doctor') {
            $counts = array_merge($counts, $this->doctorCounts($user->id));
        } elseif ($role === 'pharmacy') {
            $counts = array_merge($counts, $this->pharmacyCounts($user->id));
        } elseif ($role === 'admin') {
            $counts = array_merge($counts, $this->adminCounts());
        }

        return response()->json(['counts' => $counts]);
    }

    private function patientCounts(int $userId): array
    {
        return [
            // New prescriptions issued in the last 7 days that the patient hasn't seen
            // (we don't track viewed_at on prescriptions, so use issued recently as proxy)
            'prescriptions' => $this->safeCount(function () use ($userId) {
                return DB::table('prescriptions')
                    ->where('patient_id', $userId)
                    ->where('status', 'issued')
                    ->where('issued_at', '>=', now()->subDays(7))
                    ->count();
            }),
            'orders' => $this->safeCount(function () use ($userId) {
                return DB::table('orders')
                    ->where('patient_id', $userId)
                    ->whereIn('status', ['paid', 'dispensing', 'shipped'])
                    ->count();
            }),
            'appointments' => $this->safeCount(function () use ($userId) {
                return DB::table('appointments')
                    ->where('patient_id', $userId)
                    ->whereIn('status', ['confirmed', 'in_progress'])
                    ->whereDate('scheduled_start', '>=', now()->toDateString())
                    ->count();
            }),
            'messages' => $this->chatUnread($userId),
        ];
    }

    private function doctorCounts(int $userId): array
    {
        $todayStr = now()->toDateString();
        return [
            // Today's confirmed/in-progress appointments
            'queue' => $this->safeCount(function () use ($userId, $todayStr) {
                return DB::table('appointments')
                    ->where('doctor_id', $userId)
                    ->whereIn('status', ['confirmed', 'in_progress'])
                    ->whereDate('scheduled_start', $todayStr)
                    ->count();
            }),
            // Pool patients matching specialty / unclaimed
            'pool' => $this->safeCount(function () {
                return DB::table('appointments')
                    ->whereNull('doctor_id')
                    ->where('is_pool', 1)
                    ->whereIn('status', ['confirmed', 'pending_payment'])
                    ->count();
            }),
            // Pending tongue diagnosis reviews
            'tongue_reviews' => $this->safeCount(function () {
                if (! \Illuminate\Support\Facades\Schema::hasColumn('tongue_assessments', 'review_status')) return 0;
                return DB::table('tongue_assessments')
                    ->where('review_status', 'pending')
                    ->whereIn('status', ['completed', 'uploaded'])
                    ->count();
            }),
            // Pending constitution questionnaires (kind = ai_constitution_v2 + status = pending)
            'constitution_reviews' => $this->safeCount(function () {
                $rows = DB::table('questionnaires')->orderByDesc('id')->limit(500)->get(['symptoms']);
                $n = 0;
                foreach ($rows as $r) {
                    $s = json_decode($r->symptoms ?? '{}', true) ?: [];
                    if (($s['kind'] ?? '') !== 'ai_constitution_v2') continue;
                    if (($s['review_status'] ?? 'pending') === 'pending') $n++;
                }
                return $n;
            }),
            'messages' => $this->chatUnread($userId),
        ];
    }

    private function pharmacyCounts(int $userId): array
    {
        return [
            'orders' => $this->safeCount(function () use ($userId) {
                return DB::table('orders')
                    ->where('pharmacy_id', $userId)
                    ->whereIn('status', ['paid', 'dispensing'])
                    ->count();
            }),
            'inbox' => $this->safeCount(function () use ($userId) {
                return DB::table('prescriptions')
                    ->join('orders', 'orders.prescription_id', '=', 'prescriptions.id')
                    ->where('orders.pharmacy_id', $userId)
                    ->where('orders.status', 'paid')
                    ->count();
            }),
        ];
    }

    private function adminCounts(): array
    {
        return [
            'verifications' => $this->safeCount(function () {
                $doctors = DB::table('doctor_profiles')->where('verification_status', 'pending')->count();
                $pharms  = DB::table('pharmacy_profiles')->where('verification_status', 'pending')->count();
                return $doctors + $pharms;
            }),
            'withdrawals' => $this->safeCount(function () {
                if (! \Illuminate\Support\Facades\Schema::hasTable('withdrawals')) return 0;
                return DB::table('withdrawals')->where('status', 'pending')->count();
            }),
            'appointments' => $this->safeCount(function () {
                return DB::table('appointments')
                    ->whereDate('scheduled_start', now()->toDateString())
                    ->whereIn('status', ['confirmed', 'in_progress', 'pending_payment'])
                    ->count();
            }),
        ];
    }

    private function chatUnread(int $userId): int
    {
        return $this->safeCount(function () use ($userId) {
            // Unread messages where the user is a participant in the thread but did not send the message
            return DB::table('chat_messages')
                ->join('chat_threads', 'chat_threads.id', '=', 'chat_messages.thread_id')
                ->where(function ($q) use ($userId) {
                    $q->where('chat_threads.patient_id', $userId)->orWhere('chat_threads.doctor_id', $userId);
                })
                ->where('chat_messages.sender_id', '!=', $userId)
                ->whereNull('chat_messages.read_at')
                ->count();
        });
    }

    private function safeCount(callable $fn): int
    {
        try { return (int) $fn(); } catch (\Throwable $e) { return 0; }
    }
}
