<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Brief #15 — Google OAuth login.
 *
 * Adds the google_id column to users so we can link Google identities
 * to local accounts. avatar_url already exists on patient_profiles,
 * so we don't need a column on users for the picture.
 *
 * Apply on Railway:
 *   railway service hansmed-backend
 *   railway ssh "php artisan migrate --force"
 *
 * Rollback (drops google_id; google-only accounts will keep working
 * for password login if they happen to know their unusable random
 * password — they don't, so it's effectively a lockout for those users):
 *   railway ssh "php artisan migrate:rollback --force"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Nullable + unique so the same Google account can never be
            // attached to two HansMed users. Most rows will have NULL
            // until the patient signs in via Google for the first time.
            $table->string('google_id', 255)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn('google_id');
        });
    }
};
