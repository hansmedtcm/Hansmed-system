<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Prescription;
use Illuminate\Http\Request;

class PrescriptionInboxController extends Controller
{
    /** View prescriptions attached to orders for this pharmacy */
    public function index(Request $request)
    {
        $pharmacyId = $request->user()->id;

        $orders = Order::where('pharmacy_id', $pharmacyId)
            ->whereNotNull('prescription_id')
            ->with(['prescription.items', 'prescription.doctor.doctorProfile', 'prescription.patient.patientProfile'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($orders);
    }
}
