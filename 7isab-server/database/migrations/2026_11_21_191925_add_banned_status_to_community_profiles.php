<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds `banned` to community_profiles.status. Laravel keeps PostgreSQL enums
 * as a varchar with a check constraint, so the constraint is replaced.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->allow(['active', 'suspended', 'left', 'banned']);
    }

    public function down(): void
    {
        DB::table('community_profiles')->where('status', 'banned')->update(['status' => 'suspended']);
        $this->allow(['active', 'suspended', 'left']);
    }

    /** @param  list<string>  $statuses */
    private function allow(array $statuses): void
    {
        $values = implode(', ', array_map(fn (string $status) => "'{$status}'", $statuses));

        DB::statement('ALTER TABLE community_profiles DROP CONSTRAINT IF EXISTS community_profiles_status_check');
        DB::statement("ALTER TABLE community_profiles ADD CONSTRAINT community_profiles_status_check CHECK (status IN ({$values}))");
    }
};
