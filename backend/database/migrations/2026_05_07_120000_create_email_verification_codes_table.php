<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Brief #16e — 6-digit email verification codes.
 *
 * Stores the bcrypt'd 6-digit code we send to a user's email at
 * registration time. They have 15 minutes and 5 attempts to enter
 * the code on the verify-email screen before the entry is wiped.
 *
 * Email is the primary key — one outstanding verification per email.
 * Re-issuing a code overwrites the previous row.
 *
 * Also grandfathers EXISTING users (created before this brief shipped)
 * by setting their email_verified_at to NOW() if it's NULL. Without
 * this, existing patients/doctors would be locked out the moment we
 * enable login-blocks-unverified.
 *
 * Apply on Railway:
 *   railway service hansmed-backend
 *   railway ssh "php artisan migrate --force"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_verification_codes', function (Blueprint $t) {
            $t->string('email', 190)->primary();
            $t->string('code_hash', 255);
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->dateTime('expires_at');
            $t->dateTime('created_at')->useCurrent();
        });

        // Grandfather existing accounts so they don't get locked out
        // when the login-blocks-unverified guard ships.
        DB::statement('UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verification_codes');
        // We don't undo the grandfathering — that would lock those
        // users out and there's no auditable benefit to reverting.
    }
};
