<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Withdrawal extends Model
{
    protected $table = 'withdrawals';

    protected $fillable = [
        'user_id', 'amount', 'currency', 'status',
        'bank_info', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'bank_info'   => 'array',
        'reviewed_at' => 'datetime',
        'amount'      => 'decimal:2',
    ];
}
