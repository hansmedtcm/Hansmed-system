<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shipment extends Model
{
    protected $table = 'shipments';

    protected $fillable = [
        'order_id', 'carrier', 'tracking_no', 'status',
        'shipped_at', 'delivered_at',
    ];

    protected $casts = [
        'shipped_at'   => 'datetime',
        'delivered_at' => 'datetime',
    ];
}
