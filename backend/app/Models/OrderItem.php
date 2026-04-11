<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $table = 'order_items';
    public $timestamps = false;

    protected $fillable = [
        'order_id', 'product_id', 'drug_name', 'specification',
        'unit_price', 'quantity', 'unit', 'line_total',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'quantity'   => 'decimal:2',
        'line_total' => 'decimal:2',
    ];
}
