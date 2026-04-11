<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateAdminCommand extends Command
{
    protected $signature = 'hansmed:create-admin
                            {email : Admin email}
                            {--password= : Admin password (prompted if omitted)}';

    protected $description = 'Create or reset a platform admin account';

    public function handle(): int
    {
        $email = $this->argument('email');
        $password = $this->option('password') ?: $this->secret('Password');

        if (strlen($password) < 8) {
            $this->error('Password must be at least 8 characters.');
            return self::FAILURE;
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'password_hash' => Hash::make($password),
                'role'          => 'admin',
                'status'        => 'active',
            ],
        );

        $this->info("Admin ready: {$user->email} (id={$user->id})");
        return self::SUCCESS;
    }
}
