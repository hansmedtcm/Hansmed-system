<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Address extends Model
{
    protected $table = 'addresses';

    protected $fillable = [
        'user_id', 'recipient', 'phone', 'country', 'state', 'city',
        'line1', 'line2', 'postal_code', 'is_default',
    ];

    protected $casts = ['is_default' => 'boolean'];
}
