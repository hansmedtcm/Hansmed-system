<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notifications';
    public $timestamps = false;

    protected $fillable = ['user_id', 'type', 'title', 'body', 'data', 'read_at', 'created_at'];

    protected $casts = [
        'data'       => 'array',
        'read_at'    => 'datetime',
        'created_at' => 'datetime',
    ];
}
