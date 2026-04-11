<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $table = 'payments';

    protected $fillable = [
        'user_id', 'payable_type', 'payable_id', 'provider',
        'provider_ref', 'amount', 'currency', 'status', 'raw_payload', 'paid_at',
    ];

    protected $casts = [
        'raw_payload' => 'array',
        'paid_at'     => 'datetime',
        'amount'      => 'decimal:2',
    ];
}
