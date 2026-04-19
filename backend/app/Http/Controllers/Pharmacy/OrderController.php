<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\Shipment;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OrderController extends Controller
{
    public function __construct(private NotificationService $notifier) {}

    // P-03 / P-05: orders for this pharmacy
    public function index(Request $request)
    {
        $q = Order::where('pharmacy_id', $request->user()->id)
            ->whereIn('status', ['paid', 'dispensing', 'dispensed', 'shipped', 'delivered', 'completed'])
            ->with(['items', 'shipment', 'address', 'prescription.items', 'patient.patientProfile']);

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        return response()->json($q->orderByDesc('created_at')->paginate(20));
    }

    public function show(Request $request, int $id)
    {
        $order = Order::where('pharmacy_id', $request->user()->id)
            ->with(['items', 'shipment', 'address', 'prescription.items', 'prescription.doctor.doctorProfile', 'patient.patientProfile'])
            ->findOrFail($id);
        return response()->json(['order' => $order]);
    }

    // P-04: dispensing status transitions
    public function startDispensing(Request $request, int $id)
    {
        $order = Order::where('pharmacy_id', $request->user()->id)->findOrFail($id);
        if ($order->status !== 'paid') {
            return response()->json(['message' => 'Order not in paid state'], 422);
        }
        $order->update(['status' => 'dispensing']);
        return response()->json(['order' => $order]);
    }

    public function markDispensed(Request $request, int $id)
    {
        $order = Order::where('pharmacy_id', $request->user()->id)
            ->with('items')
            ->findOrFail($id);
        if ($order->status !== 'dispensing') {
            return response()->json(['message' => 'Order not in dispensing state'], 422);
        }

        return DB::transaction(function () use ($order, $request) {
            // Decrement inventory and write movements
            foreach ($order->items as $item) {
                if (! $item->product_id) continue;
                $inv = Inventory::where('product_id', $item->product_id)->lockForUpdate()->first();
                if (! $inv || (float) $inv->quantity_on_hand < (float) $item->quantity) {
                    abort(422, "Insufficient stock for {$item->drug_name}");
                }
                $inv->quantity_on_hand = (float) $inv->quantity_on_hand - (float) $item->quantity;
                $inv->save();

                InventoryMovement::create([
                    'product_id'     => $item->product_id,
                    'change_qty'     => -1 * (float) $item->quantity,
                    'reason'         => 'sale',
                    'reference_type' => 'order',
                    'reference_id'   => $order->id,
                    'created_by'     => $request->user()->id,
                    'created_at'     => now(),
                ]);
            }

            $order->update(['status' => 'dispensed']);

            if ($order->prescription_id) {
                $order->prescription()->update(['status' => 'dispensed']);
            }

            // Auto-decrement the master medicine catalogue (admin stock view)
            // so the overall herb inventory tracked at medicine_catalog
            // stays in sync when a pharmacy dispenses a prescription.
            // Pharmacy inventory (products/inventory table) was already
            // decremented above — this is the warehouse-level ledger.
            //
            // Matching strategy: order_items do not carry a medicine_catalog_id,
            // so we resolve by drug_name against name_zh/name_pinyin/code.
            // If no catalogue row matches, we skip silently (could be a
            // patent/imported product that isn't in the master list).
            if (Schema::hasTable('medicine_catalog') && Schema::hasColumn('medicine_catalog', 'stock_grams')) {
                foreach ($order->items as $item) {
                    $name = trim((string) ($item->drug_name ?? ''));
                    if ($name === '') continue;
                    $qty = (float) $item->quantity;
                    if ($qty <= 0) continue;
                    // order_items.unit is usually 'g'; only decrement when
                    // measured in grams so we don't deduct 30 "packs" as 30g.
                    $unit = strtolower(trim((string) ($item->unit ?? 'g')));
                    if (! in_array($unit, ['g', 'gram', 'grams', '克'], true)) continue;

                    $row = DB::table('medicine_catalog')
                        ->where('name_zh', $name)
                        ->orWhere('name_pinyin', $name)
                        ->orWhere('code', $name)
                        ->first();
                    if (! $row) continue;

                    DB::table('medicine_catalog')->where('id', $row->id)->update([
                        'stock_grams'      => DB::raw('GREATEST(0, COALESCE(stock_grams, 0) - ' . $qty . ')'),
                        'stock_updated_at' => now(),
                        'updated_at'       => now(),
                    ]);

                    // Audit trail so admin can reconcile warehouse-level
                    // movement when a patient order is dispensed.
                    if (Schema::hasTable('audit_logs')) {
                        DB::table('audit_logs')->insert([
                            'user_id'     => $request->user()->id,
                            'action'      => 'medicine.stock.decrement',
                            'target_type' => 'medicine_catalog',
                            'target_id'   => $row->id,
                            'payload'     => json_encode([
                                'reason'     => 'order_dispensed',
                                'order_id'   => $order->id,
                                'drug_name'  => $name,
                                'qty_grams'  => $qty,
                            ]),
                            'created_at'  => now(),
                        ]);
                    }
                }
            }

            return response()->json(['order' => $order]);
        });
    }

    // P-06: ship + tracking
    public function ship(Request $request, int $id)
    {
        $data = $request->validate([
            'carrier'     => ['required', 'string', 'max:80'],
            'tracking_no' => ['required', 'string', 'max:120'],
        ]);

        $order = Order::where('pharmacy_id', $request->user()->id)->findOrFail($id);
        if ($order->status !== 'dispensed') {
            return response()->json(['message' => 'Order not dispensed yet'], 422);
        }

        return DB::transaction(function () use ($order, $data) {
            Shipment::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'carrier'     => $data['carrier'],
                    'tracking_no' => $data['tracking_no'],
                    'status'      => 'shipped',
                    'shipped_at'  => now(),
                ]
            );
            $order->update(['status' => 'shipped']);
            $this->notifier->orderShipped(
                $order->patient_id, $order->id, $order->order_no,
                $data['carrier'], $data['tracking_no']
            );
            return response()->json(['order' => $order->load('shipment')]);
        });
    }
}
