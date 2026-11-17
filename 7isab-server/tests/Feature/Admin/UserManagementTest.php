<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\SyncRecord;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    public function test_list_shows_only_app_users_with_metadata(): void
    {
        $admin = $this->createAdmin();
        $users = collect(range(1, 3))->map(fn () => $this->createAppUser());

        $response = $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/admin/users?page=1&pageSize=10')
            ->assertOk()
            ->assertJsonPath('itemsCount', 3)
            ->assertJsonStructure(['items' => [['id', 'email', 'is_active', 'storage_bytes', 'devices_count']]]);

        $this->assertEqualsCanonicalizing($users->pluck('id')->all(), collect($response->json('items'))->pluck('id')->all());
        $this->assertStringNotContainsString('locked-dek', $response->getContent());
        $this->assertStringNotContainsString('kdf', $response->getContent());
    }

    public function test_list_supports_search_and_sort(): void
    {
        $admin = $this->createAdmin();
        $this->createAppUser(['email' => 'alpha@example.com', 'name' => 'Alpha']);
        $this->createAppUser(['email' => 'beta@example.com', 'name' => 'Beta']);

        $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/admin/users?search=ALPHA')
            ->assertOk()
            ->assertJsonPath('itemsCount', 1)
            ->assertJsonPath('items.0.email', 'alpha@example.com');

        $this->forgetAuth();
        $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/admin/users?sort[email]=desc')
            ->assertJsonPath('items.0.email', 'beta@example.com');

        $this->forgetAuth();
        $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/admin/users?sort[password]=asc')
            ->assertStatus(422);
    }

    public function test_show_includes_counts(): void
    {
        $admin = $this->createAdmin();
        $user = $this->createAppUser();
        $this->appHeaders($user);
        SyncRecord::create([
            'user_id' => $user->id, 'uid' => (string) Str::uuid(), 'type' => 'account', 'seq' => 1,
            'payload' => 'enc', 'payload_size' => 3, 'client_updated_at' => now(),
        ]);

        $this->withHeaders($this->adminHeaders($admin))->getJson("/api/v1/admin/users/{$user->id}")
            ->assertOk()
            ->assertJsonPath('item.devices_count', 1)
            ->assertJsonPath('item.records_count', 1);
    }

    public function test_disable_signs_the_user_out_and_blocks_login_then_enable_restores_it(): void
    {
        $admin = $this->createAdmin();
        $user = $this->createAppUser();
        $this->appHeaders($user);
        $headers = $this->adminHeaders($admin);

        $this->withHeaders($headers)->postJson("/api/v1/admin/users/{$user->id}/disable")
            ->assertOk()
            ->assertJsonPath('item.is_active', false);

        $this->assertSame(0, $user->tokens()->count());
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY, 'device_name' => 'x'])->assertStatus(403);

        $this->forgetAuth();
        $this->withHeaders($headers)->postJson("/api/v1/admin/users/{$user->id}/enable")->assertOk()->assertJsonPath('item.is_active', true);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::AUTH_KEY, 'device_name' => 'x'])->assertOk();
    }

    public function test_sign_out_revokes_all_tokens(): void
    {
        $admin = $this->createAdmin();
        $user = $this->createAppUser();
        $this->appHeaders($user, 'Phone');
        $this->appHeaders($user, 'Tablet');

        $this->withHeaders($this->adminHeaders($admin))->postJson("/api/v1/admin/users/{$user->id}/sign-out")->assertOk();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_delete_removes_account_keys_and_records_permanently(): void
    {
        $admin = $this->createAdmin();
        $user = $this->createAppUser();
        SyncRecord::create([
            'user_id' => $user->id, 'uid' => (string) Str::uuid(), 'type' => 'account', 'seq' => 1,
            'payload' => 'enc', 'payload_size' => 3, 'client_updated_at' => now(),
        ]);

        $this->withHeaders($this->adminHeaders($admin))->deleteJson("/api/v1/admin/users/{$user->id}")->assertOk();

        $this->assertNull(User::withTrashed()->find($user->id));
        $this->assertDatabaseMissing('user_keys', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('sync_records', ['user_id' => $user->id]);
    }

    public function test_admin_accounts_are_not_reachable_through_user_routes(): void
    {
        $admin = $this->createAdmin();
        $otherAdmin = $this->createAdmin(Role::SuperAdmin);
        $headers = $this->adminHeaders($admin);

        $this->withHeaders($headers)->getJson("/api/v1/admin/users/{$otherAdmin->id}")->assertStatus(404);
        $this->withHeaders($headers)->postJson("/api/v1/admin/users/{$otherAdmin->id}/disable")->assertStatus(404);
        $this->withHeaders($headers)->deleteJson("/api/v1/admin/users/{$otherAdmin->id}")->assertStatus(404);

        $this->assertTrue($otherAdmin->fresh()->is_active);
    }

    public function test_unknown_user_returns_404(): void
    {
        $admin = $this->createAdmin();

        $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/admin/users/999999')
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    public function test_stats_counts_app_users_only(): void
    {
        $admin = $this->createAdmin();
        $this->createAppUser();
        $this->createAppUser(['is_active' => false]);

        $this->withHeaders($this->adminHeaders($admin))->getJson('/api/v1/admin/stats')
            ->assertOk()
            ->assertJsonPath('statistics.users.total', 2)
            ->assertJsonPath('statistics.users.active', 1)
            ->assertJsonPath('statistics.users.disabled', 1)
            ->assertJsonPath('statistics.admins', 1);
    }
}
