<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    public const ROLE_PATIENT  = 'patient';
    public const ROLE_DOCTOR   = 'doctor';
    public const ROLE_PHARMACY = 'pharmacy';
    public const ROLE_ADMIN    = 'admin';

    protected $fillable = ['email', 'password_hash', 'role', 'status'];
    protected $hidden   = ['password_hash', 'remember_token'];

    // map Laravel's expected "password" attribute to password_hash column
    public function getAuthPassword() { return $this->password_hash; }

    public function patientProfile()  { return $this->hasOne(PatientProfile::class,  'user_id'); }
    public function doctorProfile()   { return $this->hasOne(DoctorProfile::class,   'user_id'); }
    public function pharmacyProfile() { return $this->hasOne(PharmacyProfile::class, 'user_id'); }

    public function hasRole(string $role): bool { return $this->role === $role; }
}
