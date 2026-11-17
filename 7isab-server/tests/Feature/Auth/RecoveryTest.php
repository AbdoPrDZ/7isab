<?php

namespace Tests\Feature\Auth;

use App\Modules\Auth\Support\KdfParams;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RecoveryTest extends TestCase
{
    /**
     * @return array<string, mixed>
     */
    private function resetPayload(string $email, array $overrides = []): array
    {
        return [
            'email' => $email,
            'recovery_auth' => self::RECOVERY_AUTH,
            'password' => 'brand-new-auth-key-0123456789',
            'kdf' => $this->kdf(),
            'keys' => ['password' => ['wrapped_key' => 'new-password-locked-dek']],
            'device_name' => 'New phone',
            ...$overrides,
        ];
    }

    public function test_params_returns_recovery_kdf_or_stable_fake(): void
    {
        $user = $this->createAppUser();

        $kdf = $this->postJson('/api/v1/auth/recovery/params', ['email' => $user->email])->assertOk()->json('kdf');
        $this->assertEquals($user->recoveryKey->kdf, $kdf);

        $this->postJson('/api/v1/auth/recovery/params', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertJsonPath('kdf', KdfParams::fakeFor('nobody@example.com', 'recovery'));
    }

    public function test_unlock_returns_recovery_locked_key_only_with_correct_recovery_auth(): void
    {
        $user = $this->createAppUser();

        $this->postJson('/api/v1/auth/recovery/unlock', ['email' => $user->email, 'recovery_auth' => 'wrong-recovery'])
            ->assertStatus(401);

        $this->postJson('/api/v1/auth/recovery/unlock', ['email' => 'nobody@example.com', 'recovery_auth' => self::RECOVERY_AUTH])
            ->assertStatus(401);

        $this->postJson('/api/v1/auth/recovery/unlock', ['email' => $user->email, 'recovery_auth' => self::RECOVERY_AUTH])
            ->assertOk()
            ->assertJsonPath('key.type', 'recovery')
            ->assertJsonPath('key.wrapped_key', 'recovery-locked-dek')
            ->assertJsonMissingPath('key.auth_hash');
    }

    public function test_reset_sets_new_password_signs_out_everywhere_and_returns_token(): void
    {
        $user = $this->createAppUser();
        $this->appHeaders($user, 'Lost phone');

        $response = $this->postJson('/api/v1/auth/recovery/reset', $this->resetPayload($user->email))
            ->assertOk()
            ->assertJsonPath('key.wrapped_key', 'new-password-locked-dek')
            ->assertJsonPath('key.version', 2);

        $user->refresh();
        $this->assertTrue(Hash::check('brand-new-auth-key-0123456789', $user->password));
        $this->assertSame(['New phone'], $user->tokens()->pluck('name')->all());
        $this->assertSame(1, $user->recoveryKey->version, 'recovery key unchanged when not sent');

        $this->forgetAuth();
        $this->withToken($response->json('token'))->getJson('/api/v1/auth/me')->assertOk();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY, 'device_name' => 'x'])
            ->assertStatus(401);
    }

    public function test_reset_can_also_replace_the_recovery_key(): void
    {
        $user = $this->createAppUser();

        $this->postJson('/api/v1/auth/recovery/reset', $this->resetPayload($user->email, [
            'keys' => [
                'password' => ['wrapped_key' => 'new-password-locked-dek'],
                'recovery' => ['wrapped_key' => 'new-recovery-locked-dek', 'kdf' => $this->kdf(), 'auth' => 'new-recovery-auth-0123456789'],
            ],
        ]))->assertOk();

        $recovery = $user->fresh()->recoveryKey;
        $this->assertSame('new-recovery-locked-dek', $recovery->wrapped_key);
        $this->assertSame(2, $recovery->version);
        $this->assertTrue(Hash::check('new-recovery-auth-0123456789', $recovery->auth_hash));
    }

    public function test_reset_rejects_wrong_recovery_auth_and_disabled_accounts(): void
    {
        $user = $this->createAppUser();

        $this->postJson('/api/v1/auth/recovery/reset', $this->resetPayload($user->email, ['recovery_auth' => 'wrong-recovery']))
            ->assertStatus(401);

        $user->forceFill(['is_active' => false])->save();
        $this->postJson('/api/v1/auth/recovery/reset', $this->resetPayload($user->email))->assertStatus(401);

        $this->assertTrue(Hash::check(self::AUTH_KEY, $user->fresh()->password));
    }
}
