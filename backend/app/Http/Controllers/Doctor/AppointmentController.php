<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    // D-04: list doctor's appointments by status
    public function index(Request $request)
    {
        // Appointments tab shows ONLY what this doctor has already taken.
        // Unclaimed pool bookings live in the separate Queue/Pool view;
        // the doctor must explicitly pick them up before they appear here.
        $q = Appointment::with(['patient.patientProfile'])
            ->where('doctor_id', $request->user()->id);

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($date = $request->query('date')) {
            $q->whereDate('scheduled_start', $date);
        }

        $page = $q->orderByDesc('scheduled_start')->paginate(20);

        // Layer in prescription orders + treatment fees so each card
        // can display the COMBINED total (consult fee + Rx orders +
        // treatment fees), not just the consult fee. We do this in PHP
        // rather than via SQL joins to keep the query simple.
        $apptIds = collect($page->items())->pluck('id');
        if ($apptIds->isNotEmpty()) {
            // Each appointment's prescriptions
            $rxByAppt = \App\Models\Prescription::whereIn('appointment_id', $apptIds)
                ->select('id', 'appointment_id', 'status')
                ->get()
                ->groupBy('appointment_id');

            // Paid+ orders linked to those prescriptions
            $rxIds = $rxByAppt->flatten()->pluck('id');
            $ordersByRx = $rxIds->isEmpty()
                ? collect()
                : \App\Models\Order::whereIn('prescription_id', $rxIds)
                    ->whereIn('status', ['paid', 'dispensing', 'dispensed', 'shipped', 'delivered', 'completed'])
                    ->select('id', 'order_no', 'prescription_id', 'total', 'status')
                    ->get()
                    ->groupBy('prescription_id');

            // Treatment fees from consultations.treatments JSON
            $consultRows = \DB::table('consultations')
                ->whereIn('appointment_id', $apptIds)
                ->select('appointment_id', 'treatments')
                ->get()
                ->keyBy('appointment_id');

            foreach ($page->items() as $appt) {
                $consultFee = (float) ($appt->fee ?? 0);

                // Treatment fees
                $treatmentFee = 0.0;
                $tCount = 0;
                if (isset($consultRows[$appt->id]) && $consultRows[$appt->id]->treatments) {
                    $list = json_decode($consultRows[$appt->id]->treatments, true) ?: [];
                    foreach ($list as $t) {
                        $f = (float) ($t['fee'] ?? 0);
                        if ($f > 0) { $treatmentFee += $f; $tCount++; }
                    }
                }

                // Rx-order totals across every Rx for this appt
                $rxOrderFee = 0.0;
                $rxOrderCount = 0;
                $orderSummaries = [];
                $rxs = $rxByAppt->get($appt->id, collect());
                foreach ($rxs as $rx) {
                    $orders = $ordersByRx->get($rx->id, collect());
                    foreach ($orders as $o) {
                        $rxOrderFee   += (float) $o->total;
                        $rxOrderCount += 1;
                        $orderSummaries[] = [
                            'order_no' => $o->order_no,
                            'total'    => (float) $o->total,
                            'status'   => $o->status,
                        ];
                    }
                }

                // Attach computed fields for the frontend.
                $appt->setAttribute('consult_fee',     $consultFee);
                $appt->setAttribute('treatment_fee',   $treatmentFee);
                $appt->setAttribute('treatment_count', $tCount);
                $appt->setAttribute('rx_order_fee',    $rxOrderFee);
                $appt->setAttribute('rx_order_count',  $rxOrderCount);
                $appt->setAttribute('rx_orders',       $orderSummaries);
                $appt->setAttribute('total_billed',    $consultFee + $treatmentFee + $rxOrderFee);
            }
        }

        return response()->json($page);
    }

    // D-05 / D-06: view appointment with patient + tongue report
    public function show(Request $request, int $id)
    {
        $appt = Appointment::where('doctor_id', $request->user()->id)
            ->with(['patient.patientProfile'])
            ->findOrFail($id);

        $tongue = $appt->tongue_diagnosis_id
            ? \App\Models\TongueDiagnosis::find($appt->tongue_diagnosis_id)
            : null;

        // Same fee enrichment as index() so the detail page can render
        // a full breakdown: consultation + treatments + medicine orders.
        $consultFee = (float) ($appt->fee ?? 0);
        $treatmentFee = 0.0;
        $treatmentList = [];
        $cRow = \DB::table('consultations')->where('appointment_id', $appt->id)->first();
        if ($cRow && $cRow->treatments) {
            $list = json_decode($cRow->treatments, true) ?: [];
            foreach ($list as $t) {
                $f = (float) ($t['fee'] ?? 0);
                if ($f > 0) {
                    $treatmentFee += $f;
                    $treatmentList[] = [
                        'name'    => $t['name'] ?? '—',
                        'name_zh' => $t['name_zh'] ?? '',
                        'fee'     => $f,
                    ];
                }
            }
        }

        $rxOrders = [];
        $rxOrderFee = 0.0;
        $rxs = \App\Models\Prescription::where('appointment_id', $appt->id)->pluck('id');
        if ($rxs->isNotEmpty()) {
            $orders = \App\Models\Order::whereIn('prescription_id', $rxs)
                ->whereIn('status', ['paid', 'dispensing', 'dispensed', 'shipped', 'delivered', 'completed'])
                ->select('id', 'order_no', 'prescription_id', 'total', 'status', 'paid_at')
                ->get();
            foreach ($orders as $o) {
                $rxOrderFee += (float) $o->total;
                $rxOrders[] = [
                    'id'       => $o->id,
                    'order_no' => $o->order_no,
                    'total'    => (float) $o->total,
                    'status'   => $o->status,
                    'paid_at'  => $o->paid_at,
                ];
            }
        }

        return response()->json([
            'appointment'      => $appt,
            'tongue_diagnosis' => $tongue,
            'fee_breakdown'    => [
                'consult_fee'    => $consultFee,
                'treatment_fee'  => $treatmentFee,
                'treatments'     => $treatmentList,
                'rx_order_fee'   => $rxOrderFee,
                'rx_orders'      => $rxOrders,
                'total_billed'   => $consultFee + $treatmentFee + $rxOrderFee,
            ],
        ]);
    }

    // Doctor creates an appointment for an existing patient (no payment required)
    public function storeForPatient(\Illuminate\Http\Request $request)
    {
        $data = $request->validate([
            'patient_id'      => ['required', 'integer', 'exists:users,id'],
            'scheduled_start' => ['required', 'date'],
            'scheduled_end'   => ['required', 'date', 'after:scheduled_start'],
            'fee'             => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            'concern'         => ['nullable', 'string', 'max:60'],
            'concern_label'   => ['nullable', 'string', 'max:120'],
            'recommended_specialty' => ['nullable', 'string', 'max:120'],
            'visit_type'      => ['nullable', 'in:online,walk_in'],
        ]);

        // Verify patient exists and has correct role
        $patient = \App\Models\User::where('id', $data['patient_id'])
            ->where('role', 'patient')
            ->firstOrFail();

        // Prevent double-booking the doctor
        $conflict = Appointment::where('doctor_id', $request->user()->id)
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->where('scheduled_start', '<', $data['scheduled_end'])
            ->where('scheduled_end',   '>', $data['scheduled_start'])
            ->exists();
        if ($conflict) {
            return response()->json(['message' => 'You already have an appointment in this slot'], 422);
        }

        $appt = Appointment::create([
            'patient_id'             => $data['patient_id'],
            'doctor_id'              => $request->user()->id,
            'scheduled_start'        => $data['scheduled_start'],
            'scheduled_end'          => $data['scheduled_end'],
            'status'                 => 'confirmed',
            'fee'                    => $data['fee'] ?? 0,
            'notes'                  => $data['notes'] ?? null,
            'concern'                => $data['concern'] ?? null,
            'concern_label'          => $data['concern_label'] ?? null,
            'recommended_specialty'  => $data['recommended_specialty'] ?? null,
            'is_pool'                => 0,
            'visit_type'             => $data['visit_type'] ?? 'online',
        ]);

        return response()->json(['appointment' => $appt], 201);
    }

    // D-07 hook: mark consultation started/ended
    public function start(Request $request, int $id)
    {
        // Accept pool appointments too — if they haven't been picked, assign to current doctor.
        $appt = Appointment::findOrFail($id);
        if (! $appt->doctor_id) {
            $appt->doctor_id = $request->user()->id;
            $appt->is_pool = 0;
        } elseif ($appt->doctor_id !== $request->user()->id) {
            return response()->json(['message' => 'Not your appointment'], 403);
        }

        if (in_array($appt->status, ['completed', 'cancelled', 'no_show'], true)) {
            return response()->json(['message' => 'Appointment already ' . $appt->status], 422);
        }

        // Any pre-consult state (pending_payment, paid, confirmed) → in_progress.
        $appt->status = 'in_progress';
        $appt->save();
        return response()->json(['appointment' => $appt]);
    }

    public function complete(Request $request, int $id)
    {
        $appt = Appointment::where('doctor_id', $request->user()->id)->findOrFail($id);
        $appt->update(['status' => 'completed']);
        return response()->json(['appointment' => $appt]);
    }
}
