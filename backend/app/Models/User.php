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

    protected $fillable = ['email', 'password_hash', 'role', 'status', 'must_change_password'];
    protected $hidden   = ['password_hash', 'remember_token'];
    protected $casts    = ['must_change_password' => 'boolean'];

    // map Laravel's expected "password" attribute to password_hash column
    public function getAuthPassword() { return $this->password_hash; }

    public function patientProfile()  { return $this->hasOne(PatientProfile::class,  'user_id'); }
    public function doctorProfile()   { return $this->hasOne(DoctorProfile::class,   'user_id'); }
    public function pharmacyProfile() { return $this->hasOne(PharmacyProfile::class, 'user_id'); }

    public function hasRole(string $role): bool { return $this->role === $role; }

    /**
     * Master-account list — protected super-admin emails.
     *
     * Master accounts:
     *   • Cannot be deleted (AccountController::destroy blocks)
     *   • Cannot be suspended (AccountController::toggleStatus blocks)
     *   • Cannot have their role changed (AccountController::updateAccount blocks)
     *   • Cannot have their permissions overridden (PermissionController blocks)
     *   • Always return true from hasPermission() — bypass all checks
     *
     * Hardcoded (not stored in the DB) so no admin UI action can
     * accidentally strip master protection.
     */
    private const MASTER_EMAILS = [
        'admin@hansmed.com',
    ];

    public function isMaster(): bool
    {
        return in_array(strtolower(trim($this->email ?? '')), self::MASTER_EMAILS, true);
    }

    public static function masterEmails(): array { return self::MASTER_EMAILS; }

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
        /* 0. Master accounts bypass every check — highest-power accounts
              always return true regardless of role defaults or overrides. */
        if ($this->isMaster()) return true;

        /* 1. Per-user override takes priority — but gracefully handle the
              case where the table doesn't exist yet (first boot after this
              feature ships; migration endpoint hasn't been run). Falling
              back to the role default means the admin can still reach the
              Permissions page and click "Run migration" without being
              locked out by a chicken-and-egg situation. */
        try {
            $row = \Illuminate\Support\Facades\DB::table('user_permission_overrides')
                ->where('user_id', $this->id)
                ->where('permission_key', $key)
                ->first();
            if ($row) return (bool) $row->granted;
        } catch (\Throwable $e) {
            /* Table missing or unreachable — treat as no overrides. */
        }

        /* 2. Fall back to role default */
        try {
            $raw = \Illuminate\Support\Facades\DB::table('system_configs')
                ->where('config_key', 'role_permissions')
                ->value('config_value');
        } catch (\Throwable $e) {
            $raw = null;
        }
        $map = $raw ? (json_decode($raw, true) ?: []) : [];
        $roleMap = $map[$this->role] ?? [];

        /* 3. If admin and no explicit deny, grant by default — avoids
              accidentally locking out all admins if role_permissions is
              empty/missing. Other roles default to false. */
        if (! isset($roleMap[$key])) {
            return $this->role === 'admin';
        }
        return (bool) $roleMap[$key];
    }

    /** Full effective permission map for this user (role defaults merged with overrides). */
    public function effectivePermissions(): array
    {
        try {
            $raw = \Illuminate\Support\Facades\DB::table('system_configs')
                ->where('config_key', 'role_permissions')
                ->value('config_value');
        } catch (\Throwable $e) {
            $raw = null;
        }
        $map = $raw ? (json_decode($raw, true) ?: []) : [];
        $base = $map[$this->role] ?? [];

        try {
            $overrides = \Illuminate\Support\Facades\DB::table('user_permission_overrides')
                ->where('user_id', $this->id)
                ->get(['permission_key', 'granted']);
            foreach ($overrides as $o) {
                $base[$o->permission_key] = (bool) $o->granted;
            }
        } catch (\Throwable $e) {
            /* Table missing — just return role defaults. */
        }
        return $base;
    }
}
