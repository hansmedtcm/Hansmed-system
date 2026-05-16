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
     * the Orders tab (dispensing workflow + delivery address) —
     * different controller, where the dispensing pharmacy DOES see
     * the patient's identity, contact info, and delivery address.
     *
     * Removed duplication with the Orders tab — inbox used to also
     * include active orders, which made the two views feel the same.
     *
     * Hardened 2026-05-16 (post-breach Day 2 hardening) — the
     * previous version eager-loaded `patient.patientProfile`, which
     * exposed every pending Rx's patient name to every pharmacy
     * account on the platform (PatientProfile::$hidden masks contact
     * info but NOT `full_name`). That was inconsistent with the
     * commitment in Privacy Policy v2 §7 — "practitioners see only
     * patients assigned to them" — because no pharmacy is assigned
     * to a Rx at this pre-order stage. The fix: stop eager-loading
     * `patient.patientProfile`, and strip the patient relation
     * defensively in the response mapper. Pharmacies still see the
     * herbal-formula items and the issuing doctor (needed for stock
     * pre-check and provenance), but no patient identifying data.
     *
     * Discovered by the Day 2 Security Researcher agent during the
     * post-breach blast-radius audit (Task #19 in _internal/TASKS.md).
     */
    public function index(Request $request)
    {
        $rxWith = [
            'items',
            'doctor.doctorProfile',
            // 'patient.patientProfile' DELIBERATELY OMITTED — see docblock.
            // Patient identity is revealed only at order time, in the
            // Orders tab (Pharmacy/OrderController) where pharmacy_id
            // scoping is enforced.
        ];

        $orderedRxIds = Order::whereNotNull('prescription_id')->pluck('prescription_id');
        $incomingRx = Prescription::where('status', 'issued')
            ->whereNotIn('id', $orderedRxIds)
            ->with($rxWith)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function ($rx) {
                // Defense-in-depth: strip the patient relation in case
                // an accessor or another code path lazy-loaded it.
                // The pharmacy doesn't need patient identity for
                // stock pre-check, and Privacy Policy v2 §7 commits
                // to not revealing it at this stage.
                if (method_exists($rx, 'unsetRelation')) {
                    $rx->unsetRelation('patient');
                }
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
