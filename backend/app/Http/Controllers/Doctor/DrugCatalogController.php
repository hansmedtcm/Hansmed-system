<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Read-only drug catalog for doctors writing prescriptions.
 * Aggregates listed pharmacy products across all partner pharmacies
 * and sums the total on-hand stock so the doctor can see whether
 * a medicine is available anywhere in the network.
 */
class DrugCatalogController extends Controller
{
    public function index(Request $request)
    {
        $rows = DB::table('products')
            ->leftJoin('inventory', 'inventory.product_id', '=', 'products.id')
            ->where('products.is_listed', 1)
            ->select(
                'products.name',
                'products.specification',
                'products.unit',
                DB::raw('MIN(products.unit_price) as min_price'),
                DB::raw('MAX(products.unit_price) as max_price'),
                DB::raw('COALESCE(SUM(inventory.quantity_on_hand), 0) as total_stock'),
                DB::raw('COUNT(DISTINCT products.pharmacy_id) as pharmacy_count')
            )
            ->groupBy('products.name', 'products.specification', 'products.unit')
            ->orderBy('products.name')
            ->limit(2000)
            ->get();

        return response()->json(['data' => $rows]);
    }
}
