<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Prescription;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrescriptionController extends Controller
{
    public function __construct(private NotificationService $notifier) {}

    // D-08: issue electronic prescription.
    // Either appointment_id (from a consultation) OR patient_id (from an
    // AI review with no appointment) must be provided.
    public function store(Request $request)
    {
        $data = $request->validate([
            'appointment_id'        => ['nullable', 'integer'],
            'patient_id'            => ['nullable', 'integer'],
            'source_type'           => ['nullable', 'in:tongue,constitution'],
            'source_id'             => ['nullable', 'integer'],
            'diagnosis'             => ['nullable', 'string', 'max:2000'],
            'instructions'          => ['nullable', 'string', 'max:2000'],
            'contraindications'     => ['nullable', 'string', 'max:2000'],
            'duration_days'         => ['nullable', 'integer', 'min:1', 'max:365'],
            'items'                 => ['required', 'array', 'min:1'],
            'items.*.drug_name'     => ['required', 'string', 'max:200'],
            'items.*.specification' => ['nullable', 'string', 'max:120'],
            'items.*.dosage'        => ['nullable', 'string', 'max:120'],
            'items.*.frequency'     => ['nullable', 'string', 'max:120'],
            'items.*.usage_method'  => ['nullable', 'string', 'max:255'],
            'items.*.quantity'      => ['required', 'numeric', 'min:0.01'],
            'items.*.unit'          => ['nullable', 'string', 'max:20'],
            'items.*.product_id'    => ['nullable', 'integer'],
            'items.*.notes'         => ['nullable', 'string', 'max:500'],
        ]);

        $apptId = null;
        $patientId = null;
        if (! empty($data['appointment_id'])) {
            $appt = Appointment::where('doctor_id', $request->user()->id)
                ->findOrFail($data['appointment_id']);
            $apptId = $appt->id;
            $patientId = $appt->patient_id;
        } elseif (! empty($data['patient_id'])) {
            $patientId = (int) $data['patient_id'];
        } else {
            return response()->json(['message' => 'appointment_id or patient_id required'], 422);
        }

        return DB::transaction(function () use ($apptId, $patientId, $data, $request) {
            // Build notes string to record the source context if this Rx came from an AI review
            $contextNote = null;
            if (! empty($data['source_type']) && ! empty($data['source_id'])) {
                $contextNote = 'Issued from ' . $data['source_type'] . ' review #' . $data['source_id'];
            }

            $rx = Prescription::create([
                'appointment_id'    => $apptId,
                'doctor_id'         => $request->user()->id,
                'patient_id'        => $patientId,
                'status'            => 'issued',
                'diagnosis'         => $data['diagnosis']         ?? null,
                'instructions'      => $data['instructions']      ?? null,
                'contraindications' => trim(($data['contraindications'] ?? '') . ($contextNote ? ' | ' . $contextNote : ''), ' |') ?: null,
                'duration_days'     => $data['duration_days']     ?? null,
                'issued_at'         => now(),
            ]);

            foreach ($data['items'] as $item) {
                $rx->items()->create([
                    'product_id'    => $item['product_id']    ?? null,
                    'drug_name'     => $item['drug_name'],
                    'specification' => $item['specification'] ?? null,
                    'dosage'        => $item['dosage']        ?? null,
                    'frequency'     => $item['frequency']     ?? null,
                    'usage_method'  => $item['usage_method']  ?? null,
                    'quantity'      => $item['quantity'],
                    'unit'          => $item['unit']          ?? 'g',
                    'notes'         => $item['notes']         ?? null,
                ]);
            }

            $this->notifier->prescriptionIssued($patientId, $rx->id);
            return response()->json(['prescription' => $rx->load('items')], 201);
        });
    }

    public function index(Request $request)
    {
        return response()->json(
            Prescription::where('doctor_id', $request->user()->id)
                ->with('items')
                ->orderByDesc('created_at')
                ->paginate(20)
        );
    }

    public function show(Request $request, int $id)
    {
        $rx = Prescription::where('doctor_id', $request->user()->id)
            ->with('items')
            ->findOrFail($id);
        return response()->json(['prescription' => $rx]);
    }

    // D-09: revoke
    public function revoke(Request $request, int $id)
    {
        $rx = Prescription::where('doctor_id', $request->user()->id)->findOrFail($id);
        if ($rx->status === 'dispensed') {
            return response()->json(['message' => 'Already dispensed'], 422);
        }
        $rx->update(['status' => 'revoked']);
        return response()->json(['prescription' => $rx]);
    }

    // D-09: revise — creates a NEW prescription pointing at parent (audit preserved)
    public function revise(Request $request, int $id)
    {
        $data = $request->validate([
            'diagnosis'         => ['nullable', 'string', 'max:2000'],
            'instructions'      => ['nullable', 'string', 'max:2000'],
            'contraindications' => ['nullable', 'string', 'max:2000'],
            'duration_days'     => ['nullable', 'integer', 'min:1', 'max:365'],
            'items'             => ['required', 'array', 'min:1'],
            'items.*.drug_name' => ['required', 'string', 'max:200'],
            'items.*.quantity'  => ['required', 'numeric', 'min:0.01'],
        ]);

        $parent = Prescription::where('doctor_id', $request->user()->id)->findOrFail($id);

        return DB::transaction(function () use ($parent, $data, $request) {
            $parent->update(['status' => 'revised']);

            $rx = Prescription::create([
                'appointment_id'    => $parent->appointment_id,
                'doctor_id'         => $request->user()->id,
                'patient_id'        => $parent->patient_id,
                'parent_id'         => $parent->id,
                'status'            => 'issued',
                'diagnosis'         => $data['diagnosis']         ?? $parent->diagnosis,
                'instructions'      => $data['instructions']      ?? $parent->instructions,
                'contraindications' => $data['contraindications'] ?? $parent->contraindications,
                'duration_days'     => $data['duration_days']     ?? $parent->duration_days,
                'issued_at'         => now(),
            ]);

            foreach ($data['items'] as $item) {
                $rx->items()->create([
                    'drug_name'     => $item['drug_name'],
                    'specification' => $item['specification'] ?? null,
                    'dosage'        => $item['dosage']        ?? null,
                    'frequency'     => $item['frequency']     ?? null,
                    'usage_method'  => $item['usage_method']  ?? null,
                    'quantity'      => $item['quantity'],
                    'unit'          => $item['unit']          ?? 'g',
                ]);
            }

            return response()->json(['prescription' => $rx->load('items')], 201);
        });
    }
}
