<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Brief #22 · patient_profiles health baseline.
     *
     * Hybrid 1C — patient answers safety-screen questions ONCE during
     * their first pre-assessment; subsequent pre-assessments pull these
     * forward and ask "has anything changed?".
     *
     * Idempotent: uses Schema::hasColumn() guards because some of these
     * columns may already exist in production from earlier
     * migrations / Brief #20 / model fillable that pre-date this brief
     * (the schema.sql in repo is the original sparse schema;
     * prod has had columns added over time).
     *
     * Always-NEW fields this brief introduces:
     *   - chronic_conditions  (JSON list, structured)
     *   - halal_only          (boolean)
     *   - pregnancy_status    (enum, trimester-specific)
     *   - pregnancy_status_updated_at  (timestamp)
     *
     * MAYBE-existing fields (added defensively if missing):
     *   - allergies, current_medications, medical_history
     */
    public function up(): void
    {
        Schema::table('patient_profiles', function (Blueprint $table) {
            // No `after()` clauses — MySQL throws if the referenced column
            // doesn't exist, and we don't trust the column ordering in prod.

            if (! Schema::hasColumn('patient_profiles', 'current_medications')) {
                $table->json('current_medications')->nullable();
            }
            if (! Schema::hasColumn('patient_profiles', 'chronic_conditions')) {
                $table->json('chronic_conditions')->nullable();
            }
            if (! Schema::hasColumn('patient_profiles', 'allergies')) {
                $table->text('allergies')->nullable();
            }
            if (! Schema::hasColumn('patient_profiles', 'halal_only')) {
                $table->boolean('halal_only')->nullable();
            }
            if (! Schema::hasColumn('patient_profiles', 'pregnancy_status')) {
                $table->enum('pregnancy_status', [
                    'not_applicable',
                    'not_pregnant',
                    'pregnant_1st_tri',
                    'pregnant_2nd_tri',
                    'pregnant_3rd_tri',
                    'breastfeeding',
                    'trying_to_conceive',
                ])->nullable();
            }
            if (! Schema::hasColumn('patient_profiles', 'pregnancy_status_updated_at')) {
                $table->dateTime('pregnancy_status_updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Only drop the columns this brief introduced. Don't drop
        // allergies / current_medications since they may have existed
        // pre-this-brief from older migrations.
        Schema::table('patient_profiles', function (Blueprint $table) {
            foreach (['chronic_conditions','halal_only','pregnancy_status','pregnancy_status_updated_at'] as $col) {
                if (Schema::hasColumn('patient_profiles', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
