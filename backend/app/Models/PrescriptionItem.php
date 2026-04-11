<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrescriptionItem extends Model
{
    protected $table = 'prescription_items';
    public $timestamps = false;

    protected $fillable = [
        'prescription_id', 'product_id', 'drug_name', 'specification',
        'dosage', 'frequency', 'usage_method', 'quantity', 'unit', 'notes',
    ];

    protected $casts = ['quantity' => 'decimal:2'];
}
