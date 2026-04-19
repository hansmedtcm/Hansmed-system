<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Prescription;
use Illuminate\Http\Request;

class PrescriptionInboxController extends Controller
{
    /**
     * Pharmacy prescription inbox — PRE-ORDER heads-up ONLY.
     *
     * Shows issued prescriptions that haven't been turned into an
     * order yet, so the pharmacy can pre-check stock / anticipate
     * workload before the patient pays. Once a patient places and
     * pays an order, that Rx is out of the inbox and lives under
     * the Orders tab (dispensing workflow + delivery address).
     *
     * Removed duplication with the Orders tab — inbox used to also
     * include active orders, which made the two views feel the same.
     */
    public function index(Request $request)
    {
        $rxWith = [
            'items',
            'doctor.doctorProfile',
            'patient.patientProfile',
        ];

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
            })
            ->values();

        return response()->json([
            'data'           => $incomingRx,
            'incoming_count' => $incomingRx->count(),
            'orders_count'   => 0,
        ]);
    }
}
