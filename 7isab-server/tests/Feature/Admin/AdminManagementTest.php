<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    public function test_regular_admins_cannot_manage_admins(): void
    {
        $admin = $this->createAdmin();
        $headers = $this->adminHeaders($admin);

        $this->withHeaders($headers)->getJson('/api/v1/admin/admins')->assertStatus(403);
        $this->withHeaders($headers)->postJson('/api/v1/admin/admins', [
            'email' => 'new@example.com', 'password' => 'password123', 'role' => 'admin',
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
    }

    public function test_super_admin_lists_only_admins_with_their_role(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);
        $this->createAdmin();
        $this->createAppUser();

        $this->withHeaders($this->adminHeaders($superAdmin))->getJson('/api/v1/admin/admins')
            ->assertOk()
            ->assertJsonPath('itemsCount', 2)
            ->assertJsonStructure(['items' => [['id', 'email', 'role']]]);
    }

    public function test_super_admin_creates_an_admin_who_can_sign_in(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);

        $this->withHeaders($this->adminHeaders($superAdmin))->postJson('/api/v1/admin/admins', [
            'name' => 'New Admin', 'email' => 'new@example.com', 'password' => 'password123', 'role' => 'admin',
        ])
            ->assertCreated()
            ->assertJsonPath('item.role', 'admin');

        $created = User::where('email', 'new@example.com')->firstOrFail();
        $this->assertTrue($created->hasRole('admin'));
        $this->assertNull($created->kdf);

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'new@example.com', 'password' => 'password123'])->assertOk();
    }

    public function test_create_validates_role_and_unique_email(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);
        $headers = $this->adminHeaders($superAdmin);

        $this->withHeaders($headers)->postJson('/api/v1/admin/admins', [
            'email' => 'x@example.com', 'password' => 'password123', 'role' => 'owner',
        ])->assertStatus(422)->assertJsonStructure(['errors' => ['role']]);

        $this->withHeaders($headers)->postJson('/api/v1/admin/admins', [
            'email' => $superAdmin->email, 'password' => 'password123', 'role' => 'admin',
        ])->assertStatus(422)->assertJsonStructure(['errors' => ['email']]);
    }

    public function test_super_admin_changes_role_and_password_and_old_sessions_end(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);
        $admin = $this->createAdmin();
        $this->adminHeaders($admin);

        $this->withHeaders($this->adminHeaders($superAdmin))->putJson("/api/v1/admin/admins/{$admin->id}", [
            'role' => 'super-admin',
            'password' => 'changed-password',
        ])
            ->assertOk()
            ->assertJsonPath('item.role', 'super-admin');

        $admin->refresh();
        $this->assertTrue($admin->isSuperAdmin());
        $this->assertFalse($admin->hasRole('admin'));
        $this->assertTrue(Hash::check('changed-password', $admin->password));
        $this->assertSame(0, $admin->tokens()->count());
    }

    public function test_super_admin_cannot_demote_disable_or_delete_themselves(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);
        $headers = $this->adminHeaders($superAdmin);

        $this->withHeaders($headers)->putJson("/api/v1/admin/admins/{$superAdmin->id}", ['role' => 'admin'])->assertStatus(403);
        $this->withHeaders($headers)->putJson("/api/v1/admin/admins/{$superAdmin->id}", ['is_active' => false])->assertStatus(403);
        $this->withHeaders($headers)->deleteJson("/api/v1/admin/admins/{$superAdmin->id}")->assertStatus(403);

        $superAdmin->refresh();
        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertTrue($superAdmin->is_active);

        $this->withHeaders($headers)->putJson("/api/v1/admin/admins/{$superAdmin->id}", ['name' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('item.name', 'Renamed');
    }

    public function test_super_admin_disables_and_deletes_another_admin(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);
        $admin = $this->createAdmin();
        $adminHeaders = $this->adminHeaders($admin);
        $headers = $this->adminHeaders($superAdmin);

        $this->withHeaders($headers)->putJson("/api/v1/admin/admins/{$admin->id}", ['is_active' => false])->assertOk();
        $this->assertSame(0, $admin->tokens()->count());

        $this->forgetAuth();
        $this->withHeaders($adminHeaders)->getJson('/api/v1/admin/auth/me')->assertStatus(401);

        $this->forgetAuth();
        $this->withHeaders($headers)->deleteJson("/api/v1/admin/admins/{$admin->id}")->assertOk();
        $this->assertNull(User::withTrashed()->find($admin->id));
    }

    public function test_app_users_are_not_reachable_through_admin_routes(): void
    {
        $superAdmin = $this->createAdmin(Role::SuperAdmin);
        $user = $this->createAppUser();

        $this->withHeaders($this->adminHeaders($superAdmin))->putJson("/api/v1/admin/admins/{$user->id}", ['role' => 'admin'])
            ->assertStatus(404);

        $this->assertFalse($user->fresh()->isAdmin());
    }
}
