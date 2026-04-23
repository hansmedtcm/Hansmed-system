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

    /**
     * Resolve whether this user has a named permission.
     *
     * Check order:
     *   1. Per-user override in user_permission_overrides (granted true/false)
     *   2. Role default from system_configs.role_permissions JSON
     *   3. Otherwise false
     *
     * Per-user overrides let an admin give one doctor access to finance
     * while another doctor in the same role does not.
     */
    public function hasPermission(string $key): bool
    {
        /* 1. Per-user override takes priority */
        $row = \Illuminate\Support\Facades\DB::table('user_permission_overrides')
            ->where('user_id', $this->id)
            ->where('permission_key', $key)
            ->first();
        if ($row) return (bool) $row->granted;

        /* 2. Fall back to role default */
        $raw = \Illuminate\Support\Facades\DB::table('system_configs')
            ->where('config_key', 'role_permissions')
            ->value('config_value');
        $map = $raw ? (json_decode($raw, true) ?: []) : [];
        $roleMap = $map[$this->role] ?? [];
        return (bool) ($roleMap[$key] ?? false);
    }

    /** Full effective permission map for this user (role defaults merged with overrides). */
    public function effectivePermissions(): array
    {
        $raw = \Illuminate\Support\Facades\DB::table('system_configs')
            ->where('config_key', 'role_permissions')
            ->value('config_value');
        $map = $raw ? (json_decode($raw, true) ?: []) : [];
        $base = $map[$this->role] ?? [];

        $overrides = \Illuminate\Support\Facades\DB::table('user_permission_overrides')
            ->where('user_id', $this->id)
            ->get(['permission_key', 'granted']);

        foreach ($overrides as $o) {
            $base[$o->permission_key] = (bool) $o->granted;
        }
        return $base;
    }
}
