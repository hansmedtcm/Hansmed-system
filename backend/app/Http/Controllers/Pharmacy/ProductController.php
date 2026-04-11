<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    // P-07 / P-08: catalog + inventory
    public function index(Request $request)
    {
        return response()->json(
            Product::where('pharmacy_id', $request->user()->id)
                ->with('inventory')
                ->orderByDesc('id')
                ->paginate(30)
        );
    }

    public function store(Request $request)
    {
        $data = $this->rules($request);
        return DB::transaction(function () use ($data, $request) {
            $product = Product::create(['pharmacy_id' => $request->user()->id] + $data);
            Inventory::create([
                'product_id'        => $product->id,
                'quantity_on_hand'  => $data['initial_stock']     ?? 0,
                'reorder_threshold' => $data['reorder_threshold'] ?? 0,
            ]);
            return response()->json(['product' => $product->load('inventory')], 201);
        });
    }

    public function update(Request $request, int $id)
    {
        $product = Product::where('pharmacy_id', $request->user()->id)->findOrFail($id);
        $data = $this->rules($request, updating: true);
        $product->update($data);
        return response()->json(['product' => $product->load('inventory')]);
    }

    // P-07: stock adjustment
    public function adjustStock(Request $request, int $id)
    {
        $data = $request->validate([
            'change_qty' => ['required', 'numeric'],
            'reason'     => ['required', 'in:purchase,sale,adjustment,return,stocktake'],
        ]);

        $product = Product::where('pharmacy_id', $request->user()->id)->findOrFail($id);

        return DB::transaction(function () use ($product, $data, $request) {
            $inv = Inventory::where('product_id', $product->id)->lockForUpdate()->firstOrFail();
            $inv->quantity_on_hand = (float) $inv->quantity_on_hand + (float) $data['change_qty'];
            if ($inv->quantity_on_hand < 0) {
                return response()->json(['message' => 'Insufficient stock'], 422);
            }
            $inv->save();

            InventoryMovement::create([
                'product_id'  => $product->id,
                'change_qty'  => $data['change_qty'],
                'reason'      => $data['reason'],
                'created_by'  => $request->user()->id,
                'created_at'  => now(),
            ]);

            return response()->json(['inventory' => $inv]);
        });
    }

    private function rules(Request $request, bool $updating = false): array
    {
        $base = $updating ? 'sometimes|' : '';
        return $request->validate([
            'name'              => [$base . 'required', 'string', 'max:200'],
            'sku'               => ['nullable', 'string', 'max:80'],
            'specification'     => ['nullable', 'string', 'max:120'],
            'description'       => ['nullable', 'string', 'max:5000'],
            'image_url'         => ['nullable', 'url', 'max:500'],
            'unit'              => ['nullable', 'string', 'max:20'],
            'unit_price'        => [$base . 'required', 'numeric', 'min:0'],
            'is_listed'         => ['nullable', 'boolean'],
            'initial_stock'     => ['nullable', 'numeric', 'min:0'],
            'reorder_threshold' => ['nullable', 'numeric', 'min:0'],
        ]);
    }
}
