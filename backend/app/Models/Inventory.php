<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    protected $table = 'inventory';
    public $timestamps = false;

    protected $fillable = ['product_id', 'quantity_on_hand', 'reorder_threshold'];

    protected $casts = [
        'quantity_on_hand'  => 'decimal:2',
        'reorder_threshold' => 'decimal:2',
    ];
}
