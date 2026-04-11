<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PatientProfile extends Model
{
    protected $table = 'patient_profiles';
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = [
        'user_id', 'nickname', 'avatar_url', 'gender', 'birth_date',
        'phone', 'height_cm', 'weight_kg',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'height_cm'  => 'decimal:2',
        'weight_kg'  => 'decimal:2',
    ];

    public function user() { return $this->belongsTo(User::class, 'user_id'); }
}
