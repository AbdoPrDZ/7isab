<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rule_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('community_profiles')->cascadeOnDelete();
            $table->string('rule_key');
            $table->unsignedInteger('version');
            $table->timestamp('accepted_at');
            $table->unique(['profile_id', 'rule_key', 'version']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rule_acceptances');
    }
};
