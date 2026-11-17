<?php

namespace Tests;

use App\Enums\Role;
use App\Enums\UserKeyType;
use App\Models\User;
use App\Models\UserKey;
use App\Modules\Auth\Actions\IssueAccessToken;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /** Roles are seeded for every test. */
    protected bool $seed = true;

    protected string $seeder = RoleSeeder::class;

    /** The auth key every test app user signs in with. */
    protected const AUTH_KEY = 'test-auth-key-0123456789abcdef';

    /** The recovery auth key every test app user registers with. */
    protected const RECOVERY_AUTH = 'test-recovery-auth-0123456789';

    /**
     * @return array{algorithm: string, salt: string, params: array<string, int>}
     */
    protected function kdf(): array
    {
        return ['algorithm' => 'scrypt', 'salt' => base64_encode(random_bytes(16)), 'params' => ['N' => 32768, 'r' => 8, 'p' => 1]];
    }

    /**
     * A valid registration body, as the app would send it.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function registrationPayload(array $overrides = []): array
    {
        return array_replace_recursive([
            'name' => 'Test User',
            'email' => 'user'.Str::random(6).'@example.com',
            'password' => self::AUTH_KEY,
            'kdf' => $this->kdf(),
            'keys' => [
                'password' => ['wrapped_key' => 'password-locked-dek'],
                'recovery' => ['wrapped_key' => 'recovery-locked-dek', 'kdf' => $this->kdf(), 'auth' => self::RECOVERY_AUTH],
            ],
            'device_name' => 'Test phone',
        ], $overrides);
    }

    /** An app user with both key envelopes stored. */
    protected function createAppUser(array $attributes = []): User
    {
        $user = User::factory()->create(['password' => self::AUTH_KEY, ...$attributes]);

        UserKey::create(['user_id' => $user->id, 'type' => UserKeyType::Password, 'wrapped_key' => 'password-locked-dek', 'kdf' => $user->kdf]);
        UserKey::create([
            'user_id' => $user->id, 'type' => UserKeyType::Recovery, 'wrapped_key' => 'recovery-locked-dek',
            'kdf' => $this->kdf(), 'auth_hash' => self::RECOVERY_AUTH,
        ]);

        return $user;
    }

    protected function createAdmin(Role $role = Role::Admin, array $attributes = []): User
    {
        return User::factory()->admin($role)->create(['password' => 'admin-password', ...$attributes]);
    }

    /**
     * @return array<string, string>
     */
    protected function appHeaders(User $user, string $device = 'Test phone'): array
    {
        return ['Authorization' => 'Bearer '.app(IssueAccessToken::class)->handle($user, IssueAccessToken::APP, $device)];
    }

    /**
     * @return array<string, string>
     */
    protected function adminHeaders(User $admin): array
    {
        return ['Authorization' => 'Bearer '.app(IssueAccessToken::class)->handle($admin, IssueAccessToken::ADMIN, 'admin-panel')];
    }

    /**
     * Sanctum caches the resolved user per request in tests; reset between
     * requests made as different users or after tokens are revoked.
     */
    protected function forgetAuth(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
