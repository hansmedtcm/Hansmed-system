<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $table = 'products';

    protected $fillable = [
        'pharmacy_id', 'sku', 'name', 'specification', 'description',
        'image_url', 'unit', 'unit_price', 'is_listed',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'is_listed'  => 'boolean',
    ];

    public function inventory() { return $this->hasOne(Inventory::class); }
}
