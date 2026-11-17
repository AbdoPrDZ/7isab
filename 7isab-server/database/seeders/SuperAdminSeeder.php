<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Creates the first super admin from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.
 * Skipped when either is missing. Never overwrites an existing password.
 */
class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('hisab.super_admin.email');
        $password = config('hisab.super_admin.password');

        if (! $email || ! $password) {
            $this->command?->warn('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set: no super admin created.');

            return;
        }

        $user = User::firstOrCreate(
            ['email' => $email],
            ['name' => 'Super Admin', 'password' => $password, 'kdf' => null, 'is_active' => true],
        );

        $user->assignRole(Role::SuperAdmin->value);
    }
}
