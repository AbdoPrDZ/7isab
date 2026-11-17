<?php

namespace Tests\Feature\Vault;

use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class VaultTest extends TestCase
{
    public function test_returns_the_password_locked_key(): void
    {
        $user = $this->createAppUser();

        $this->withHeaders($this->appHeaders($user))->getJson('/api/v1/vault/key')
            ->assertOk()
            ->assertJsonPath('key.type', 'password')
            ->assertJsonPath('key.wrapped_key', 'password-locked-dek');
    }

    public function test_replacing_the_recovery_key_requires_the_password(): void
    {
        $user = $this->createAppUser();
        $headers = $this->appHeaders($user);
        $body = ['keys' => ['recovery' => ['wrapped_key' => 'rotated-dek', 'kdf' => $this->kdf(), 'auth' => 'rotated-recovery-auth-0123']]];

        $this->withHeaders($headers)->putJson('/api/v1/vault/recovery', ['password' => 'wrong', ...$body])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['password']]);

        $this->withHeaders($headers)->putJson('/api/v1/vault/recovery', ['password' => self::AUTH_KEY, ...$body])
            ->assertOk()
            ->assertJsonPath('version', 2);

        $recovery = $user->fresh()->recoveryKey;
        $this->assertSame('rotated-dek', $recovery->wrapped_key);
        $this->assertTrue(Hash::check('rotated-recovery-auth-0123', $recovery->auth_hash));
    }

    public function test_vault_requires_an_app_token(): void
    {
        $this->getJson('/api/v1/vault/key')->assertStatus(401);

        $this->withHeaders($this->adminHeaders($this->createAdmin()))->getJson('/api/v1/vault/key')->assertStatus(403);
    }
}
