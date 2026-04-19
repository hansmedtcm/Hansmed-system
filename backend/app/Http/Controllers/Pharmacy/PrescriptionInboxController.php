<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Prescription;
use Illuminate\Http\Request;

class PrescriptionInboxController extends Controller
{
    /**
     * Pharmacy prescription inbox.
     *
     * Two streams combined into one feed so the pharmacy sees every
     * Rx that might land on their desk, not only the ones a patient
     * has already paid for:
     *
     *   A. "incoming" — issued prescriptions with no order yet.
     *      These are fresh Rx from doctor consultations, waiting
     *      for the patient to place an order. Shown so the
     *      pharmacy can anticipate workload and pre-check stock.
     *
     *   B. "active"   — orders attached to THIS pharmacy that carry
     *      a prescription (paid / dispensing / dispensed / shipped).
     *
     * Each row returns a uniform shape: { kind, id, order_no,
     * status, prescription: {...}, created_at }.
     */
    public function index(Request $request)
    {
        $pharmacyId = $request->user()->id;

        $rxWith = [
            'items',
            'doctor.doctorProfile',
            'patient.patientProfile',
        ];

        // B. Orders attached to this pharmacy (the historical behaviour).
        //    Eager-load address so the pharmacist sees exactly where
        //    the package needs to go — critical for the packing desk.
        $orders = Order::where('pharmacy_id', $pharmacyId)
            ->whereNotNull('prescription_id')
            ->with(array_merge(
                array_map(fn($rel) => 'prescription.' . $rel, $rxWith),
                ['address', 'patient.patientProfile']
            ))
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($o) {
                return [
                    'kind'         => 'order',
                    'id'           => $o->id,
                    'order_no'     => $o->order_no,
                    'order_id'     => $o->id,
                    'status'       => $o->status,
                    'prescription' => $o->prescription,
                    'address'      => $o->address,     // delivery address for packing
                    'patient'      => $o->patient,     // order-side patient (== Rx patient)
                    'created_at'   => $o->created_at,
                ];
            });

        // A. Issued prescriptions that haven't been turned into an
        //    order yet. The pharmacy pool is shared — any approved
        //    pharmacy can see the pipeline.
        $orderedRxIds = Order::whereNotNull('prescription_id')->pluck('prescription_id');
        $incomingRx = Prescription::where('status', 'issued')
            ->whereNotIn('id', $orderedRxIds)
            ->with($rxWith)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function ($rx) {
                return [
                    'kind'         => 'incoming',
                    'id'           => $rx->id,
                    'order_no'     => 'RX-' . $rx->id,
                    'order_id'     => null,
                    'status'       => 'awaiting_patient_order',
                    'prescription' => $rx,
                    'created_at'   => $rx->created_at,
                ];
            });

        $merged = $incomingRx->concat($orders)
            ->sortByDesc('created_at')
            ->values();

        return response()->json([
            'data'           => $merged,
            'incoming_count' => $incomingRx->count(),
            'orders_count'   => $orders->count(),
        ]);
    }
}
