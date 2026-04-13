<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PosController extends Controller
{
    /** List products available for POS sale (from logged-in pharmacy) */
    public function products(Request $request)
    {
        $q = Product::where('pharmacy_id', $request->user()->id)
            ->where('is_listed', true)
            ->with('inventory');

        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', "%{$s}%")
                  ->orWhere('sku', 'like', "%{$s}%");
            });
        }

        return response()->json($q->orderBy('name')->get());
    }

    /** Create a POS sale (walk-in / OTC / prescription pickup) */
    public function sale(Request $request)
    {
        $data = $request->validate([
            'items'               => ['required', 'array', 'min:1'],
            'items.*.product_id'  => ['required', 'integer'],
            'items.*.quantity'    => ['required', 'numeric', 'min:0.01'],
            'payment_method'      => ['required', 'in:cash,card,ewallet_tng,ewallet_grab,ewallet_shopee,fpx'],
            'amount_received'     => ['nullable', 'numeric', 'min:0'],
            'patient_name'        => ['nullable', 'string', 'max:120'],
            'patient_id'          => ['nullable', 'integer'],
            'prescription_id'     => ['nullable', 'integer'],
            'notes'               => ['nullable', 'string', 'max:500'],
            'sale_type'           => ['nullable', 'in:walk_in,otc,prescription'],
        ]);

        return DB::transaction(function () use ($data, $request) {
            $pharmacyId = $request->user()->id;
            $items = [];
            $subtotal = 0;

            foreach ($data['items'] as $item) {
                $product = Product::where('id', $item['product_id'])
                    ->where('pharmacy_id', $pharmacyId)
                    ->firstOrFail();

                $inv = Inventory::where('product_id', $product->id)->lockForUpdate()->first();
                if (!$inv || (float) $inv->quantity_on_hand < (float) $item['quantity']) {
                    abort(422, "Insufficient stock for {$product->name}");
                }

                $lineTotal = (float) $product->unit_price * (float) $item['quantity'];
                $subtotal += $lineTotal;

                $inv->quantity_on_hand = (float) $inv->quantity_on_hand - (float) $item['quantity'];
                $inv->save();

                InventoryMovement::create([
                    'product_id'     => $product->id,
                    'change_qty'     => -1 * (float) $item['quantity'],
                    'reason'         => 'sale',
                    'reference_type' => 'pos_sale',
                    'reference_id'   => null,
                    'created_by'     => $request->user()->id,
                    'created_at'     => now(),
                ]);

                $items[] = [
                    'product_id'    => $product->id,
                    'name'          => $product->name,
                    'specification' => $product->specification,
                    'unit_price'    => $product->unit_price,
                    'quantity'      => $item['quantity'],
                    'unit'          => $product->unit,
                    'line_total'    => $lineTotal,
                ];
            }

            $saleNo = 'POS-' . now()->format('Ymd') . '-' . strtoupper(Str::random(4));
            $amountReceived = $data['amount_received'] ?? $subtotal;
            $change = max(0, $amountReceived - $subtotal);

            $sale = DB::table('pos_sales')->insertGetId([
                'sale_no'         => $saleNo,
                'pharmacy_id'     => $pharmacyId,
                'cashier_id'      => $request->user()->id,
                'patient_name'    => $data['patient_name'] ?? null,
                'patient_id'      => $data['patient_id'] ?? null,
                'prescription_id' => $data['prescription_id'] ?? null,
                'sale_type'       => $data['sale_type'] ?? 'walk_in',
                'payment_method'  => $data['payment_method'],
                'subtotal'        => $subtotal,
                'tax'             => 0,
                'total'           => $subtotal,
                'amount_received' => $amountReceived,
                'change_amount'   => $change,
                'notes'           => $data['notes'] ?? null,
                'items'           => json_encode($items),
                'created_at'      => now(),
            ]);

            return response()->json([
                'sale' => [
                    'id'              => $sale,
                    'sale_no'         => $saleNo,
                    'items'           => $items,
                    'subtotal'        => $subtotal,
                    'total'           => $subtotal,
                    'payment_method'  => $data['payment_method'],
                    'amount_received' => $amountReceived,
                    'change'          => $change,
                    'patient_name'    => $data['patient_name'] ?? null,
                    'sale_type'       => $data['sale_type'] ?? 'walk_in',
                    'created_at'      => now()->toIso8601String(),
                ],
            ], 201);
        });
    }

    /** Sales history */
    public function history(Request $request)
    {
        $q = DB::table('pos_sales')
            ->where('pharmacy_id', $request->user()->id);

        if ($date = $request->query('date')) {
            $q->whereDate('created_at', $date);
        }

        $sales = $q->orderByDesc('created_at')->paginate(30);

        // Decode items JSON
        foreach ($sales as &$s) {
            $s->items = json_decode($s->items, true);
        }

        return response()->json($sales);
    }

    /** Get single sale for receipt reprinting */
    public function show(Request $request, int $id)
    {
        $sale = DB::table('pos_sales')
            ->where('pharmacy_id', $request->user()->id)
            ->where('id', $id)
            ->first();

        if (!$sale) abort(404);
        $sale->items = json_decode($sale->items, true);

        return response()->json(['sale' => $sale]);
    }

    /** Daily summary */
    public function dailySummary(Request $request)
    {
        $date = $request->query('date', now()->toDateString());
        $pharmacyId = $request->user()->id;

        $sales = DB::table('pos_sales')
            ->where('pharmacy_id', $pharmacyId)
            ->whereDate('created_at', $date)
            ->get();

        $totalSales = $sales->count();
        $totalRevenue = $sales->sum('total');
        $byCash = $sales->where('payment_method', 'cash')->sum('total');
        $byCard = $sales->where('payment_method', 'card')->sum('total');
        $byEwallet = $sales->whereIn('payment_method', ['ewallet_tng', 'ewallet_grab', 'ewallet_shopee'])->sum('total');
        $byFpx = $sales->where('payment_method', 'fpx')->sum('total');

        return response()->json([
            'date'          => $date,
            'total_sales'   => $totalSales,
            'total_revenue' => $totalRevenue,
            'by_method'     => [
                'cash'    => $byCash,
                'card'    => $byCard,
                'ewallet' => $byEwallet,
                'fpx'     => $byFpx,
            ],
        ]);
    }
}
