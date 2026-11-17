<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    public function test_admin_can_sign_in_and_gets_an_expiring_admin_token(): void
    {
        $admin = $this->createAdmin(Role::SuperAdmin);

        $this->postJson('/api/v1/admin/auth/login', ['email' => $admin->email, 'password' => 'admin-password'])
            ->assertOk()
            ->assertJsonPath('user.role', 'super-admin')
            ->assertJsonStructure(['token']);

        $token = $admin->tokens()->first();
        $this->assertSame(['admin'], $token->abilities);
        $this->assertNotNull($token->expires_at);
    }

    public function test_app_users_and_wrong_passwords_cannot_sign_in_to_the_panel(): void
    {
        $user = $this->createAppUser();
        $admin = $this->createAdmin();

        $this->postJson('/api/v1/admin/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY])->assertStatus(401);
        $this->postJson('/api/v1/admin/auth/login', ['email' => $admin->email, 'password' => 'wrong'])->assertStatus(401);
    }

    public function test_disabled_admin_cannot_sign_in(): void
    {
        $admin = $this->createAdmin(attributes: ['is_active' => false]);

        $this->postJson('/api/v1/admin/auth/login', ['email' => $admin->email, 'password' => 'admin-password'])->assertStatus(403);
    }

    public function test_app_tokens_are_rejected_on_admin_routes(): void
    {
        $user = $this->createAppUser();

        $this->withHeaders($this->appHeaders($user))->getJson('/api/v1/admin/auth/me')->assertStatus(403);

        $this->forgetAuth();
        $this->flushHeaders()->getJson('/api/v1/admin/auth/me')->assertStatus(401);
    }

    public function test_admin_ability_without_role_is_rejected(): void
    {
        $user = $this->createAppUser();

        $this->withHeaders($this->adminHeaders($user))->getJson('/api/v1/admin/auth/me')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden.');
    }

    public function test_me_and_logout(): void
    {
        $admin = $this->createAdmin();
        $headers = $this->adminHeaders($admin);

        $this->withHeaders($headers)->getJson('/api/v1/admin/auth/me')->assertOk()->assertJsonPath('user.role', 'admin');
        $this->withHeaders($headers)->postJson('/api/v1/admin/auth/logout')->assertOk();

        $this->forgetAuth();
        $this->withHeaders($headers)->getJson('/api/v1/admin/auth/me')->assertStatus(401);
    }
}
