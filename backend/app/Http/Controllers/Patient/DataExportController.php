<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\Appointment;
use App\Models\Order;
use App\Models\Prescription;
use App\Models\TongueAssessment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * PDPA §30 "right of access" — patient can request a structured
 * export of every record we hold about them. Returns a single JSON
 * bundle the patient can save, share with another clinic, or
 * inspect before requesting deletion.
 *
 * Scope is strictly the authenticated user — never someone else's
 * records. No third-party data is included (chat counterparty
 * metadata is reduced to their display name; no sensitive profile
 * fields from other users).
 */
class DataExportController extends Controller
{
    public function export(Request $request)
    {
        $user = $request->user();
        $userId = $user->id;

        // Also log the access itself so we can prove the patient
        // retrieved their own copy (PDPA audit trail).
        DB::table('audit_logs')->insert([
            'user_id'     => $userId,
            'action'      => 'data_export.requested',
            'target_type' => 'user',
            'target_id'   => $userId,
            'payload'     => json_encode(['ip' => $request->ip()]),
            'created_at'  => now(),
        ]);

        // Profile — omit password_hash, remember_token, etc.
        $profile = [
            'id'        => $user->id,
            'email'     => $user->email,
            'role'      => $user->role,
            'status'    => $user->status ?? null,
            'created_at'=> $user->created_at,
        ];
        if (method_exists($user, 'patientProfile')) {
            $pp = $user->patientProfile;
            if ($pp) {
                $profile['patient_profile'] = $pp->makeHidden([])->toArray();
            }
        }

        $appointments = Appointment::where('patient_id', $userId)
            ->orderByDesc('scheduled_start')
            ->get()
            ->map(function ($a) {
                return [
                    'id'              => $a->id,
                    'scheduled_start' => $a->scheduled_start,
                    'scheduled_end'   => $a->scheduled_end,
                    'status'          => $a->status,
                    'visit_type'      => $a->visit_type,
                    'concern'         => $a->concern,
                    'concern_label'   => $a->concern_label,
                    'fee'             => $a->fee,
                    'notes'           => $a->notes,
                    'created_at'      => $a->created_at,
                ];
            });

        $prescriptions = Prescription::where('patient_id', $userId)
            ->with('items')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($rx) {
                return [
                    'id'             => $rx->id,
                    'status'         => $rx->status,
                    'diagnosis'      => $rx->diagnosis,
                    'instructions'   => $rx->instructions,
                    'duration_days'  => $rx->duration_days,
                    'issued_at'      => $rx->issued_at,
                    'items'          => $rx->items->map(function ($i) {
                        return [
                            'drug_name'   => $i->drug_name,
                            'quantity'    => $i->quantity,
                            'unit'        => $i->unit,
                            'dosage'      => $i->dosage,
                            'frequency'   => $i->frequency,
                            'usage_method'=> $i->usage_method,
                            'notes'       => $i->notes,
                        ];
                    })->toArray(),
                ];
            });

        $orders = Order::where('patient_id', $userId)
            ->with(['items', 'shipment', 'address'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($o) {
                return [
                    'id'         => $o->id,
                    'order_no'   => $o->order_no,
                    'status'     => $o->status,
                    'subtotal'   => $o->subtotal,
                    'shipping'   => $o->shipping_fee,
                    'total'      => $o->total,
                    'currency'   => $o->currency,
                    'paid_at'    => $o->paid_at,
                    'items'      => $o->items ? $o->items->toArray() : [],
                    'address'    => $o->address ? $o->address->toArray() : null,
                    'shipment'   => $o->shipment ? $o->shipment->toArray() : null,
                    'created_at' => $o->created_at,
                ];
            });

        $tongueDiagnoses = TongueAssessment::where('patient_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($t) {
                return [
                    'id'                  => $t->id,
                    'status'              => $t->status,
                    'review_status'       => $t->review_status,
                    'image_url'           => $t->image_url,
                    'health_score'        => $t->health_score,
                    'constitution_report' => $t->constitution_report,
                    'doctor_comment'      => $t->doctor_comment,
                    'reviewed_at'         => $t->reviewed_at,
                    'created_at'          => $t->created_at,
                ];
            });

        $questionnaires = DB::table('questionnaires')
            ->where('patient_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($q) {
                return [
                    'id'         => $q->id,
                    'symptoms'   => json_decode($q->symptoms ?? '{}', true),
                    'created_at' => $q->created_at,
                ];
            });

        $addresses = Address::where('user_id', $userId)->get()->toArray();

        // PDPA §30 — the user is entitled to see every consent grant /
        // revoke we have on file about them. Table was added 2026-04-21
        // alongside the consent modal flow (docs/ux/consent-copy.md).
        $consents = [];
        if (\Illuminate\Support\Facades\Schema::hasTable('consent_grants')) {
            $consents = DB::table('consent_grants')
                ->where('user_id', $userId)
                ->orderBy('granted_at')
                ->get(['purpose_id', 'granted', 'consent_version',
                       'granted_at', 'ip_address', 'user_agent',
                       'related_booking', 'note'])
                ->map(function ($c) {
                    return [
                        'purpose_id'      => $c->purpose_id,
                        'granted'         => (bool) $c->granted,
                        'consent_version' => $c->consent_version,
                        'granted_at'      => $c->granted_at,
                        'ip_address'      => $c->ip_address,
                        'user_agent'      => $c->user_agent,
                        'related_booking' => $c->related_booking,
                        'note'            => $c->note,
                    ];
                })
                ->toArray();
        }

        // Chat — include messages the user sent + received, but strip
        // PII from the counterparty (keep display name only).
        $chat = [];
        if (\Illuminate\Support\Facades\Schema::hasTable('chat_threads')) {
            $threads = DB::table('chat_threads as t')
                ->leftJoin('patient_profiles as pp', 'pp.user_id', '=', 't.patient_id')
                ->leftJoin('doctor_profiles as dp', 'dp.user_id', '=', 't.doctor_id')
                ->where(function ($q) use ($userId) {
                    $q->where('t.patient_id', $userId)->orWhere('t.doctor_id', $userId);
                })
                ->select('t.id', 't.created_at', 't.updated_at', 't.status',
                         'pp.full_name as patient_name', 'dp.full_name as doctor_name')
                ->get();
            foreach ($threads as $th) {
                $msgs = DB::table('chat_messages')
                    ->where('thread_id', $th->id)
                    ->orderBy('created_at')
                    ->get(['sender_id', 'message', 'image_url', 'created_at'])
                    ->map(function ($m) use ($userId) {
                        return [
                            'sent_by_me' => $m->sender_id == $userId,
                            'message'    => $m->message,
                            'image_url'  => $m->image_url,
                            'created_at' => $m->created_at,
                        ];
                    });
                $chat[] = [
                    'thread_id'      => $th->id,
                    'counterparty'   => $th->patient_name ?: $th->doctor_name,
                    'created_at'     => $th->created_at,
                    'last_activity'  => $th->updated_at,
                    'messages'       => $msgs,
                ];
            }
        }

        $payload = [
            '_meta' => [
                'generated_at' => now()->toIso8601String(),
                'generated_for'=> $user->email,
                'scope'        => 'self',
                'format_version'=> 1,
                'pdpa_notice'  => 'This export is your personal data as defined by PDPA 2010 §4. You may share it or use it for any lawful purpose. If you believe anything is incorrect, use Settings → contact support to request correction (PDPA §31). To request deletion, use Settings → Delete Account.',
            ],
            'profile'            => $profile,
            'addresses'          => $addresses,
            'appointments'       => $appointments,
            'prescriptions'      => $prescriptions,
            'orders'             => $orders,
            'tongue_scans'       => $tongueDiagnoses,
            'constitution_reports' => $questionnaires,
            'chat_threads'       => $chat,
            'consent_history'    => $consents,
        ];

        // Filename suggestion: hansmed-export-<email-slug>-<date>.json
        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower(explode('@', $user->email)[0] ?? 'patient'));
        $filename = 'hansmed-export-' . $slug . '-' . now()->format('Ymd') . '.json';

        return response()->json($payload)
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
    }
}
