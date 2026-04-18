<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Medicine purchase-order log.
 *
 * Every time the clinic receives a shipment from a supplier (Timing Herbs
 * or otherwise), admin logs it here with invoice number, company, medicine
 * reference, quantity, price. Creating a row automatically increments the
 * medicine's stock_grams so the stock view stays accurate without any
 * manual double-entry.
 */
class MedicinePurchaseController extends Controller
{
    /** List recent purchase orders with medicine + supplier filters. */
    public function index(Request $request)
    {
        if (! Schema::hasTable('medicine_purchases')) {
            return response()->json(['data' => [], 'total' => 0]);
        }

        $q = DB::table('medicine_purchases as p')
            ->leftJoin('medicine_catalog as m', 'm.id', '=', 'p.medicine_id')
            ->select(
                'p.id', 'p.medicine_id', 'p.invoice_no', 'p.supplier_name',
                'p.purchase_date', 'p.quantity_grams', 'p.pack_grams', 'p.pack_count',
                'p.total_cost', 'p.unit_cost_per_gram', 'p.notes', 'p.created_at',
                'm.code as medicine_code', 'm.name_zh', 'm.name_pinyin'
            );

        if ($search = $request->query('q')) {
            $q->where(function ($w) use ($search) {
                $w->where('p.invoice_no',    'like', "%{$search}%")
                  ->orWhere('p.supplier_name', 'like', "%{$search}%")
                  ->orWhere('m.name_zh',       'like', "%{$search}%")
                  ->orWhere('m.name_pinyin',   'like', "%{$search}%")
                  ->orWhere('m.code',          'like', "%{$search}%");
            });
        }
        if ($from = $request->query('from')) $q->whereDate('p.purchase_date', '>=', $from);
        if ($to   = $request->query('to'))   $q->whereDate('p.purchase_date', '<=', $to);
        if ($med  = $request->query('medicine_id')) $q->where('p.medicine_id', $med);

        $rows = $q->orderByDesc('p.purchase_date')->orderByDesc('p.id')->limit(500)->get();

        // Summary stats for the top-of-page pills
        $summary = [
            'count'         => $rows->count(),
            'total_grams'   => (float) $rows->sum('quantity_grams'),
            'total_cost'    => (float) $rows->sum('total_cost'),
            'supplier_count'=> $rows->pluck('supplier_name')->unique()->filter()->count(),
        ];

        return response()->json(['data' => $rows, 'summary' => $summary]);
    }

    /**
     * Log a new purchase. Auto-increments medicine_catalog.stock_grams by
     * quantity_grams and updates stock_updated_at.
     *
     * Supported input shapes (any one is enough to determine quantity):
     *   • quantity_grams alone
     *   • pack_count + pack_grams → quantity_grams = pack_count × pack_grams
     * total_cost + pack_grams derivation:
     *   • unit_cost_per_gram = total_cost / quantity_grams (auto-computed
     *     server-side so admin UI doesn't have to)
     */
    public function store(Request $request)
    {
        if (! Schema::hasTable('medicine_purchases')) {
            abort(response()->json(['message' => 'Run the medicine-catalog migration first.'], 400));
        }

        $data = $request->validate([
            'medicine_id'    => ['required', 'integer', 'exists:medicine_catalog,id'],
            'invoice_no'     => ['nullable', 'string', 'max:80'],
            'supplier_name'  => ['required', 'string', 'max:160'],
            'purchase_date'  => ['required', 'date'],
            'quantity_grams' => ['nullable', 'numeric', 'min:0.01'],
            'pack_grams'     => ['nullable', 'numeric', 'min:0.01'],
            'pack_count'     => ['nullable', 'numeric', 'min:0.01'],
            'total_cost'     => ['nullable', 'numeric', 'min:0'],
            'notes'          => ['nullable', 'string', 'max:500'],
            // Convenience flags
            'update_unit_price' => ['nullable', 'boolean'],
        ]);

        // Derive quantity_grams if the admin only gave packs
        $qtyGrams = isset($data['quantity_grams']) ? (float) $data['quantity_grams'] : null;
        if ($qtyGrams === null && !empty($data['pack_grams']) && !empty($data['pack_count'])) {
            $qtyGrams = (float) $data['pack_grams'] * (float) $data['pack_count'];
        }
        if ($qtyGrams === null || $qtyGrams <= 0) {
            return response()->json([
                'errors' => ['quantity_grams' => ['Provide either quantity_grams, or pack_grams + pack_count.']],
            ], 422);
        }

        $unitCostPerGram = null;
        if (!empty($data['total_cost']) && $qtyGrams > 0) {
            $unitCostPerGram = round(((float) $data['total_cost']) / $qtyGrams, 4);
        }

        return DB::transaction(function () use ($data, $qtyGrams, $unitCostPerGram, $request) {
            $purchaseId = DB::table('medicine_purchases')->insertGetId([
                'medicine_id'        => $data['medicine_id'],
                'invoice_no'         => $data['invoice_no'] ?? null,
                'supplier_name'      => $data['supplier_name'],
                'purchase_date'      => $data['purchase_date'],
                'quantity_grams'     => $qtyGrams,
                'pack_grams'         => $data['pack_grams'] ?? null,
                'pack_count'         => $data['pack_count'] ?? null,
                'total_cost'         => $data['total_cost'] ?? null,
                'unit_cost_per_gram' => $unitCostPerGram,
                'notes'              => $data['notes'] ?? null,
                'created_by'         => $request->user()->id,
                'created_at'         => now(),
            ]);

            // Bump stock on the medicine row
            $updates = [
                'stock_grams'      => DB::raw('COALESCE(stock_grams, 0) + ' . (float) $qtyGrams),
                'stock_updated_at' => now(),
                'updated_at'       => now(),
            ];
            // Optionally update the reference unit_price on the catalog
            // from this purchase's pack pricing (admin checkbox).
            if (!empty($data['update_unit_price']) && !empty($data['total_cost'])) {
                if (!empty($data['pack_grams'])) {
                    // Store pack price — "per X grams" — on the medicine row
                    $updates['unit_price'] = round((float) $data['total_cost'] /
                        max((float) ($data['pack_count'] ?? 1), 0.01), 2);
                    $updates['pack_grams'] = (float) $data['pack_grams'];
                }
            }
            DB::table('medicine_catalog')->where('id', $data['medicine_id'])->update($updates);

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'medicine.purchase.create',
                'target_type' => 'medicine_purchase',
                'target_id'   => $purchaseId,
                'payload'     => json_encode([
                    'medicine_id'   => $data['medicine_id'],
                    'invoice'       => $data['invoice_no'] ?? null,
                    'supplier'      => $data['supplier_name'],
                    'qty_grams'     => $qtyGrams,
                    'cost'          => $data['total_cost'] ?? null,
                ]),
                'created_at'  => now(),
            ]);

            return response()->json([
                'id'               => $purchaseId,
                'quantity_grams'   => $qtyGrams,
                'unit_cost_per_gram' => $unitCostPerGram,
                'new_stock_grams'  => DB::table('medicine_catalog')
                    ->where('id', $data['medicine_id'])
                    ->value('stock_grams'),
            ], 201);
        });
    }

    /**
     * Delete a purchase-order row. Rolls back the stock increment that was
     * applied when it was created, so admin can recover from a data-entry
     * mistake cleanly.
     */
    public function destroy(Request $request, int $id)
    {
        if (! Schema::hasTable('medicine_purchases')) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return DB::transaction(function () use ($id, $request) {
            $row = DB::table('medicine_purchases')->where('id', $id)->first();
            if (! $row) return response()->json(['message' => 'Not found'], 404);

            DB::table('medicine_catalog')->where('id', $row->medicine_id)->update([
                'stock_grams'      => DB::raw('GREATEST(0, COALESCE(stock_grams, 0) - ' . (float) $row->quantity_grams . ')'),
                'stock_updated_at' => now(),
                'updated_at'       => now(),
            ]);
            DB::table('medicine_purchases')->where('id', $id)->delete();

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'medicine.purchase.delete',
                'target_type' => 'medicine_purchase',
                'target_id'   => $id,
                'payload'     => json_encode(['reversed_grams' => (float) $row->quantity_grams]),
                'created_at'  => now(),
            ]);

            return response()->json(['deleted' => true, 'reversed_grams' => (float) $row->quantity_grams]);
        });
    }
}
