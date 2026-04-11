<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $table = 'orders';

    protected $fillable = [
        'order_no', 'patient_id', 'pharmacy_id', 'prescription_id', 'address_id',
        'status', 'subtotal', 'shipping_fee', 'total', 'currency',
        'payment_id', 'paid_at', 'cancelled_at',
    ];

    protected $casts = [
        'subtotal'     => 'decimal:2',
        'shipping_fee' => 'decimal:2',
        'total'        => 'decimal:2',
        'paid_at'      => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function items()        { return $this->hasMany(OrderItem::class); }
    public function shipment()     { return $this->hasOne(Shipment::class); }
    public function prescription() { return $this->belongsTo(Prescription::class); }
    public function address()      { return $this->belongsTo(Address::class); }
}
