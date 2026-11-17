<?php

namespace Tests\Feature\Database;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Spatie\Permission\Models\Role as SpatieRole;
use Tests\TestCase;

class SeederTest extends TestCase
{
    public function test_roles_are_seeded_on_the_sanctum_guard(): void
    {
        $this->assertEqualsCanonicalizing(
            ['super-admin', 'admin'],
            SpatieRole::where('guard_name', 'sanctum')->pluck('name')->all(),
        );
    }

    public function test_super_admin_seeder_creates_the_account_from_config_once(): void
    {
        config(['hisab.super_admin.email' => 'owner@example.com', 'hisab.super_admin.password' => 'owner-password']);

        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $owner = User::where('email', 'owner@example.com')->sole();
        $this->assertTrue($owner->isSuperAdmin());
        $this->assertNull($owner->kdf);
    }

    public function test_super_admin_seeder_skips_without_config(): void
    {
        config(['hisab.super_admin.email' => null, 'hisab.super_admin.password' => null]);

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, User::count());
    }
}
