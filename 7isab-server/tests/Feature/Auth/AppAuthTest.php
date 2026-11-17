<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Modules\Auth\Support\KdfParams;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AppAuthTest extends TestCase
{
    public function test_prelogin_returns_the_real_kdf_for_an_existing_user(): void
    {
        $user = $this->createAppUser();

        $kdf = $this->postJson('/api/v1/auth/prelogin', ['email' => $user->email])->assertOk()->json('kdf');

        $this->assertEquals($user->kdf, $kdf);
    }

    public function test_prelogin_returns_stable_fake_kdf_for_unknown_emails_and_admins(): void
    {
        $first = $this->postJson('/api/v1/auth/prelogin', ['email' => 'nobody@example.com'])->assertOk()->json('kdf');
        $second = $this->postJson('/api/v1/auth/prelogin', ['email' => 'nobody@example.com'])->json('kdf');
        $other = $this->postJson('/api/v1/auth/prelogin', ['email' => 'someone-else@example.com'])->json('kdf');

        $this->assertSame($first, $second, 'fake KDF must be stable so it looks real');
        $this->assertNotSame($first['salt'], $other['salt']);
        $this->assertSame(KdfParams::DEFAULT_PARAMS, $first['params']);

        $admin = $this->createAdmin();
        $this->postJson('/api/v1/auth/prelogin', ['email' => $admin->email])
            ->assertJsonPath('kdf', KdfParams::fakeFor($admin->email));
    }

    public function test_register_creates_account_keys_and_token(): void
    {
        $payload = $this->registrationPayload();

        $response = $this->postJson('/api/v1/auth/register', $payload)
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.email', $payload['email'])
            ->assertJsonPath('key.type', 'password')
            ->assertJsonPath('key.wrapped_key', 'password-locked-dek')
            ->assertJsonMissingPath('user.password')
            ->assertJsonMissingPath('user.kdf');

        $user = User::where('email', $payload['email'])->firstOrFail();
        $this->assertTrue(Hash::check(self::AUTH_KEY, $user->password));
        $this->assertEquals($payload['kdf'], $user->kdf, 'jsonb may reorder keys; values must match');
        $this->assertCount(2, $user->keys);
        $this->assertTrue(Hash::check(self::RECOVERY_AUTH, $user->recoveryKey->auth_hash));
        $this->assertFalse($user->isAdmin());

        $this->forgetAuth();
        $this->withToken($response->json('token'))->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_register_validates_input(): void
    {
        $existing = $this->createAppUser();

        $this->postJson('/api/v1/auth/register', $this->registrationPayload(['email' => $existing->email]))
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['email']]);

        $this->postJson('/api/v1/auth/register', $this->registrationPayload(['kdf' => ['algorithm' => 'md5']]))
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['kdf.algorithm']]);

        $missingRecovery = $this->registrationPayload();
        unset($missingRecovery['keys']['recovery']);
        $this->postJson('/api/v1/auth/register', $missingRecovery)->assertStatus(422);

        $this->postJson('/api/v1/auth/register', $this->registrationPayload(['password' => 'short']))
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['password']]);
    }

    public function test_login_returns_token_and_locked_key(): void
    {
        $user = $this->createAppUser();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY, 'device_name' => 'Phone'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email'], 'key' => ['type', 'wrapped_key', 'kdf', 'version']])
            ->assertJsonPath('key.wrapped_key', 'password-locked-dek');

        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertSame('Phone', $user->tokens()->first()->name);
        $this->assertSame(['app'], $user->tokens()->first()->abilities);
    }

    public function test_login_rejects_wrong_password_unknown_email_and_admins_with_same_message(): void
    {
        $user = $this->createAppUser();
        $admin = $this->createAdmin();

        $attempts = [
            ['email' => $user->email, 'password' => 'wrong-auth-key'],
            ['email' => 'nobody@example.com', 'password' => self::AUTH_KEY],
            ['email' => $admin->email, 'password' => 'admin-password'],
        ];

        foreach ($attempts as $attempt) {
            $this->postJson('/api/v1/auth/login', [...$attempt, 'device_name' => 'Phone'])
                ->assertStatus(401)
                ->assertJsonPath('message', 'Invalid email or password.');
        }
    }

    public function test_disabled_user_cannot_login_or_use_existing_token(): void
    {
        $user = $this->createAppUser();
        $headers = $this->appHeaders($user);
        $user->forceFill(['is_active' => false])->save();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY, 'device_name' => 'Phone'])
            ->assertStatus(403);

        $this->forgetAuth();
        $this->withHeaders($headers)->getJson('/api/v1/auth/me')->assertStatus(403);
    }

    public function test_protected_routes_require_an_app_token(): void
    {
        $this->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('success', false);

        $admin = $this->createAdmin();
        $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/auth/me')->assertStatus(403);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = $this->createAppUser();
        $phone = $this->appHeaders($user, 'Phone');
        $tablet = $this->appHeaders($user, 'Tablet');

        $this->withHeaders($phone)->postJson('/api/v1/auth/logout')->assertOk();
        $this->forgetAuth();

        $this->withHeaders($phone)->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->forgetAuth();
        $this->withHeaders($tablet)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_logout_all_revokes_every_token(): void
    {
        $user = $this->createAppUser();
        $phone = $this->appHeaders($user, 'Phone');
        $this->appHeaders($user, 'Tablet');

        $this->withHeaders($phone)->postJson('/api/v1/auth/logout-all')->assertOk();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_change_password_relocks_key_and_signs_out_other_devices(): void
    {
        $user = $this->createAppUser();
        $phone = $this->appHeaders($user, 'Phone');
        $this->appHeaders($user, 'Tablet');
        $newKdf = $this->kdf();

        $this->withHeaders($phone)->putJson('/api/v1/auth/password', [
            'current_password' => self::AUTH_KEY,
            'password' => 'new-auth-key-0123456789abcdef',
            'kdf' => $newKdf,
            'keys' => ['password' => ['wrapped_key' => 'relocked-dek']],
        ])
            ->assertOk()
            ->assertJsonPath('key.wrapped_key', 'relocked-dek')
            ->assertJsonPath('key.version', 2);

        $user->refresh();
        $this->assertTrue(Hash::check('new-auth-key-0123456789abcdef', $user->password));
        $this->assertEquals($newKdf, $user->kdf);
        $this->assertSame(1, $user->tokens()->count(), 'only the requesting device stays signed in');
        $this->assertSame('Phone', $user->tokens()->first()->name);
    }

    public function test_change_password_requires_the_current_password(): void
    {
        $user = $this->createAppUser();

        $this->withHeaders($this->appHeaders($user))->putJson('/api/v1/auth/password', [
            'current_password' => 'wrong-auth-key',
            'password' => 'new-auth-key-0123456789abcdef',
            'kdf' => $this->kdf(),
            'keys' => ['password' => ['wrapped_key' => 'relocked-dek']],
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['current_password']]);

        $this->assertTrue(Hash::check(self::AUTH_KEY, $user->fresh()->password));
    }

    public function test_login_is_rate_limited(): void
    {
        $user = $this->createAppUser();

        foreach (range(1, 5) as $ignored) {
            $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong', 'device_name' => 'Phone'])->assertStatus(401);
        }

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY, 'device_name' => 'Phone'])
            ->assertStatus(429)
            ->assertJsonPath('success', false);
    }
}
