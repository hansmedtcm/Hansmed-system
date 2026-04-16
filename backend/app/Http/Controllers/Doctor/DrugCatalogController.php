<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only drug catalog for doctors writing prescriptions.
 *
 * Combines two data sources:
 *   1. `medicine_catalog` — master Timing Herbs price list (reference prices,
 *      canonical names). Always shown if seeded.
 *   2. `products` + `inventory` — actual pharmacy stock across partner
 *      pharmacies, so the doctor can see whether a medicine is currently
 *      in stock somewhere in the network.
 *
 * The two sources are merged by Chinese name so the doctor gets a single
 * unified list even if a pharmacy hasn't loaded that item into its
 * inventory yet.
 */
class DrugCatalogController extends Controller
{
    public function index(Request $request)
    {
        // 1. Per-pharmacy product rows (what's in stock anywhere)
        $products = DB::table('products')
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
            ->get()
            ->keyBy(fn($r) => mb_strtolower(trim($r->name)));

        // 2. Master Timing Herbs catalogue (reference prices + canonical names)
        $catalog = collect();
        if (Schema::hasTable('medicine_catalog')) {
            $catalog = DB::table('medicine_catalog')
                ->where('is_active', 1)
                ->select('code', 'name_zh', 'name_pinyin', 'type', 'unit_price', 'unit')
                ->orderBy('type')->orderBy('name_pinyin')
                ->limit(2000)
                ->get();
        }

        // Merge — catalogue provides canonical entry; product row (if any)
        // overlays with current stock + pharmacy count.
        $byName = [];
        foreach ($catalog as $c) {
            $display = $c->name_zh . ' · ' . $c->name_pinyin;
            $byName[mb_strtolower($display)] = (object) [
                'name'           => $display,
                'name_zh'        => $c->name_zh,
                'name_pinyin'    => $c->name_pinyin,
                'code'           => $c->code,
                'type'           => $c->type,           // single | compound
                'specification'  => $c->type === 'compound' ? '浓缩细粒 复方' : '浓缩细粒',
                'unit'           => $c->unit,
                'min_price'      => $c->unit_price,
                'max_price'      => $c->unit_price,
                'total_stock'    => 0,
                'pharmacy_count' => 0,
                'source'         => 'catalog',
            ];
        }
        foreach ($products as $p) {
            // Try to match the product against the catalog entries by the Chinese herb name
            $matched = null;
            foreach ($byName as $k => $v) {
                if (mb_strpos($v->name_zh, $p->name) !== false || mb_strpos($p->name, $v->name_zh) !== false) {
                    $matched = $k; break;
                }
            }
            if ($matched) {
                $byName[$matched]->total_stock    = (float) $p->total_stock;
                $byName[$matched]->pharmacy_count = (int)   $p->pharmacy_count;
            } else {
                $byName[mb_strtolower($p->name)] = (object) [
                    'name'           => $p->name,
                    'name_zh'        => $p->name,
                    'name_pinyin'    => '',
                    'code'           => null,
                    'type'           => 'single',
                    'specification'  => $p->specification,
                    'unit'           => $p->unit,
                    'min_price'      => $p->min_price,
                    'max_price'      => $p->max_price,
                    'total_stock'    => (float) $p->total_stock,
                    'pharmacy_count' => (int)   $p->pharmacy_count,
                    'source'         => 'pharmacy',
                ];
            }
        }

        $rows = array_values($byName);
        usort($rows, function ($a, $b) {
            return strcmp($a->name, $b->name);
        });

        return response()->json(['data' => $rows]);
    }
}
