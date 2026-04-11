<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryMovement extends Model
{
    protected $table = 'inventory_movements';
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'change_qty', 'reason',
        'reference_type', 'reference_id', 'created_by', 'created_at',
    ];
}
