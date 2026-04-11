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

    // D-08: issue electronic prescription
    public function store(Request $request)
    {
        $data = $request->validate([
            'appointment_id'        => ['required', 'integer'],
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

        $appt = Appointment::where('doctor_id', $request->user()->id)
            ->findOrFail($data['appointment_id']);

        return DB::transaction(function () use ($appt, $data, $request) {
            $rx = Prescription::create([
                'appointment_id'    => $appt->id,
                'doctor_id'         => $request->user()->id,
                'patient_id'        => $appt->patient_id,
                'status'            => 'issued',
                'diagnosis'         => $data['diagnosis']         ?? null,
                'instructions'      => $data['instructions']      ?? null,
                'contraindications' => $data['contraindications'] ?? null,
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

            $this->notifier->prescriptionIssued($appt->patient_id, $rx->id);
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
