<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PharmacyProfile extends Model
{
    protected $table = 'pharmacy_profiles';
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = [
        'user_id', 'name', 'license_no', 'license_doc_url', 'business_doc_url',
        'verification_status', 'address_line', 'city', 'state', 'country',
        'postal_code', 'latitude', 'longitude', 'delivery_radius_km',
        'business_hours', 'phone',
    ];

    public function user() { return $this->belongsTo(User::class, 'user_id'); }
}
