<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Order;
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

        // Stock-availability gate — block the issue if any herb is
        // missing from the catalog or out of stock.
        if ($problems = $this->validateStockAvailability($data['items'])) {
            return $this->stockProblemsResponse($problems);
        }

        return DB::transaction(function () use ($apptId, $patientId, $data, $request) {
            // If the doctor re-issues the Rx for the same appointment
            // (after going back to edit), supersede any previous issued
            // Rx so the pharmacy inbox / patient view only sees the
            // latest one. Locked once the patient has paid for a
            // medicine order tied to that Rx — from that point the
            // doctor cannot overwrite; admin can still intervene.
            if ($apptId) {
                $existing = Prescription::where('appointment_id', $apptId)
                    ->whereIn('status', ['issued', 'revised'])
                    ->get();
                foreach ($existing as $old) {
                    $locked = Order::where('prescription_id', $old->id)
                        ->whereIn('status', ['paid', 'dispensed', 'shipped', 'completed'])
                        ->exists();
                    if ($locked) {
                        return response()->json([
                            'message' => 'Cannot re-issue: patient has already paid for this prescription. Contact admin to amend.',
                            'message_zh' => '無法重新開立：患者已付款。如需修改請聯絡管理員。',
                        ], 422);
                    }
                    // Clear items first to avoid orphan rows, then delete
                    // the parent. The audit trail lives in audit_logs if
                    // enabled — prescriptions table itself stays clean.
                    $old->items()->delete();
                    $old->delete();
                }
            }

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
        $q = Prescription::where('doctor_id', $request->user()->id)
            ->with(['items', 'patient.patientProfile'])
            ->orderByDesc('created_at');

        // Optional filter — used by the consult view to pre-fill the Rx
        // pad when the doctor re-enters a completed appointment to edit
        // medicines.
        if ($apptId = $request->query('appointment_id')) {
            $q->where('appointment_id', $apptId)
              ->whereIn('status', ['issued']);
        }

        return response()->json($q->paginate(20));
    }

    public function show(Request $request, int $id)
    {
        $rx = Prescription::where('doctor_id', $request->user()->id)
            ->with(['items', 'patient.patientProfile'])
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

    /**
     * Stock-availability gate run before issuing or revising a
     * prescription. Per clinic policy, a prescription cannot be issued
     * unless every herb on it is BOTH:
     *   (a) present in the medicine_catalog (or matched via loose
     *       name_zh / name_pinyin lookup mirroring OrderController), AND
     *   (b) has stock_grams >= the requested quantity.
     *
     * Returns null on success; an array of human-readable problems
     * on failure (caller maps to HTTP 422 with the list shown to the
     * doctor so they know which lines to swap or order in).
     */
    private function validateStockAvailability(array $items): ?array
    {
        $problems = [];

        foreach ($items as $i => $item) {
            $rawName = trim((string) ($item['drug_name'] ?? ''));
            if ($rawName === '') continue;

            $qty = (float) ($item['quantity'] ?? 0);
            if ($qty <= 0) continue;

            // Build candidate names — same shape as OrderController so
            // a herb labeled '艾葉 · Ai Ye' matches both halves.
            $candidates = [$rawName];
            foreach (preg_split('/\s*[·・•\|]\s*/u', $rawName) as $piece) {
                $p = trim($piece);
                if ($p !== '' && ! in_array($p, $candidates, true)) $candidates[] = $p;
            }

            $catalog = \DB::table('medicine_catalog')
                ->where('is_active', 1)
                ->where(function ($q) use ($candidates) {
                    foreach ($candidates as $c) {
                        $q->orWhere('name_zh', $c)->orWhere('name_pinyin', $c);
                    }
                })
                ->first();
            if (! $catalog) {
                foreach ($candidates as $c) {
                    if (mb_strlen($c) < 2) continue;
                    $catalog = \DB::table('medicine_catalog')
                        ->where('is_active', 1)
                        ->where(function ($q) use ($c) {
                            $q->where('name_zh', 'like', '%' . $c . '%')
                              ->orWhere('name_pinyin', 'like', '%' . $c . '%');
                        })
                        ->first();
                    if ($catalog) break;
                }
            }

            if (! $catalog) {
                $problems[] = [
                    'index'     => $i,
                    'drug_name' => $rawName,
                    'reason'    => 'not_in_catalog',
                    'message'   => "{$rawName} — not in the medicine catalogue. Add it to the catalogue first, or pick an alternative herb.",
                    'message_zh' => "{$rawName} — 不在藥材目錄中，請先建立藥材資料或改用其他可替代藥材。",
                ];
                continue;
            }

            // stock_grams may not exist on legacy rows (column was added
            // later). Treat null as 0 — strictest interpretation.
            $stock = $catalog->stock_grams ?? null;
            if ($stock === null) {
                $problems[] = [
                    'index'     => $i,
                    'drug_name' => $rawName,
                    'reason'    => 'unknown_stock',
                    'message'   => "{$rawName} — stock not tracked yet (catalog row exists but stock_grams is null). Set the current stock in admin → Medicine Stock first.",
                    'message_zh' => "{$rawName} — 庫存尚未登記，請先於「藥材庫存」設定當前存量。",
                ];
                continue;
            }

            $stock = (float) $stock;
            if ($stock < $qty) {
                $problems[] = [
                    'index'         => $i,
                    'drug_name'     => $rawName,
                    'reason'        => $stock <= 0 ? 'out_of_stock' : 'insufficient_stock',
                    'requested'     => $qty,
                    'available'     => $stock,
                    'message'       => $stock <= 0
                        ? "{$rawName} — out of stock (0g available). Order in via the pharmacy or pick an alternative herb."
                        : "{$rawName} — insufficient stock (asked for {$qty}g, only {$stock}g on hand). Reduce the quantity or pick an alternative.",
                    'message_zh'    => $stock <= 0
                        ? "{$rawName} — 已缺貨（庫存 0g）。請先補貨或改用其他可替代藥材。"
                        : "{$rawName} — 庫存不足（需 {$qty}g，僅有 {$stock}g）。請減量或改用其他藥材。",
                ];
            }
        }

        return empty($problems) ? null : $problems;
    }

    /** Helper that builds the 422 error payload for the stock gate. */
    private function stockProblemsResponse(array $problems)
    {
        return response()->json([
            'message'    => 'Cannot issue prescription — stock check failed',
            'message_zh' => '無法開立處方 — 庫存檢查未通過',
            'problems'   => $problems,
            'reason'     => 'stock_unavailable',
        ], 422);
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

        // Stock check applies to revisions too — the new line-up has to
        // be fulfillable, not the parent's. Otherwise a revise could
        // bypass the gate by editing in unavailable herbs.
        if ($problems = $this->validateStockAvailability($data['items'])) {
            return $this->stockProblemsResponse($problems);
        }

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
