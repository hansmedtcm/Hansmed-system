<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ChatController extends Controller
{
    /** List chat threads for current user */
    public function threads(Request $request)
    {
        $userId = $request->user()->id;
        $threads = DB::table('chat_threads')
            ->where('patient_id', $userId)
            ->orWhere('doctor_id', $userId)
            ->orderByDesc('updated_at')
            ->get();

        foreach ($threads as &$t) {
            $t->last_message = DB::table('chat_messages')
                ->where('thread_id', $t->id)
                ->orderByDesc('created_at')
                ->first();
            $t->unread_count = DB::table('chat_messages')
                ->where('thread_id', $t->id)
                ->where('sender_id', '!=', $userId)
                ->whereNull('read_at')
                ->count();
        }

        return response()->json(['threads' => $threads]);
    }

    /** Get or create a thread between patient and doctor */
    public function getOrCreateThread(Request $request)
    {
        $data = $request->validate([
            'doctor_id'      => ['required_without:patient_id', 'integer'],
            'patient_id'     => ['required_without:doctor_id', 'integer'],
            'appointment_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $patientId = $user->role === 'patient' ? $user->id : ($data['patient_id'] ?? null);
        $doctorId = $user->role === 'doctor' ? $user->id : ($data['doctor_id'] ?? null);

        if (!$patientId || !$doctorId) {
            return response()->json(['message' => 'Both patient and doctor required'], 422);
        }

        $thread = DB::table('chat_threads')
            ->where('patient_id', $patientId)
            ->where('doctor_id', $doctorId)
            ->where('status', 'active')
            ->first();

        if (!$thread) {
            $id = DB::table('chat_threads')->insertGetId([
                'patient_id'     => $patientId,
                'doctor_id'      => $doctorId,
                'appointment_id' => $data['appointment_id'] ?? null,
                'status'         => 'active',
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
            $thread = DB::table('chat_threads')->find($id);
        }

        return response()->json(['thread' => $thread]);
    }

    /** Get messages in a thread */
    public function messages(Request $request, int $threadId)
    {
        $userId = $request->user()->id;
        $thread = DB::table('chat_threads')->find($threadId);
        if (!$thread || ($thread->patient_id !== $userId && $thread->doctor_id !== $userId)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Mark messages as read
        DB::table('chat_messages')
            ->where('thread_id', $threadId)
            ->where('sender_id', '!=', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $messages = DB::table('chat_messages')
            ->where('thread_id', $threadId)
            ->orderBy('created_at')
            ->limit(200)
            ->get();

        return response()->json(['messages' => $messages, 'thread' => $thread]);
    }

    /** Send a message */
    public function send(Request $request, int $threadId)
    {
        $userId = $request->user()->id;
        $thread = DB::table('chat_threads')->find($threadId);
        if (!$thread || ($thread->patient_id !== $userId && $thread->doctor_id !== $userId)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'message' => ['required_without:image', 'nullable', 'string', 'max:5000'],
            'image'   => ['nullable', 'image', 'max:5120'],
        ]);

        $imageUrl = null;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('chat', 'public');
            $imageUrl = Storage::disk('public')->url($path);
        }

        $id = DB::table('chat_messages')->insertGetId([
            'thread_id'  => $threadId,
            'sender_id'  => $userId,
            'message'    => $data['message'] ?? '',
            'image_url'  => $imageUrl,
            'created_at' => now(),
        ]);

        DB::table('chat_threads')->where('id', $threadId)->update(['updated_at' => now()]);

        return response()->json([
            'message' => DB::table('chat_messages')->find($id),
        ], 201);
    }
}
