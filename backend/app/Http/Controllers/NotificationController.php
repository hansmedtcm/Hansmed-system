<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // C-18 / D-13 / P-10: list + mark read
    public function index(Request $request)
    {
        $q = Notification::where('user_id', $request->user()->id);
        if ($request->boolean('unread_only')) {
            $q->whereNull('read_at');
        }
        return response()->json($q->orderByDesc('created_at')->paginate(30));
    }

    public function unreadCount(Request $request)
    {
        return response()->json([
            'count' => Notification::where('user_id', $request->user()->id)
                ->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(Request $request, int $id)
    {
        $n = Notification::where('user_id', $request->user()->id)->findOrFail($id);
        $n->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }
}
