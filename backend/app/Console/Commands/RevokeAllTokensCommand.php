<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-off security command: revoke ALL Sanctum personal access tokens.
 * Used after a credential leak to invalidate every active token.
 * Every user will be force-logged-out on next API call.
 *
 *   php artisan hansmed:revoke-all-tokens --confirm
 */
class RevokeAllTokensCommand extends Command
{
    protected $signature = 'hansmed:revoke-all-tokens {--confirm : Required confirmation flag}';
    protected $description = 'Revoke ALL Sanctum personal access tokens. Forces every user to re-login.';

    public function handle(): int
    {
        if (! $this->option('confirm')) {
            $this->error('Refusing to run without --confirm. This will log out every user.');
            return 1;
        }

        $count = DB::table('personal_access_tokens')->count();
        $this->warn("About to revoke {$count} access tokens.");

        DB::table('personal_access_tokens')->delete();

        $this->info("✓ Revoked {$count} tokens. Every user must re-login.");
        return 0;
    }
}
