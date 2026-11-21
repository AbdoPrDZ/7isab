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
        Schema::create('spaces', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['group', 'page']);
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('purpose');
            $table->text('goals');
            $table->text('content_plan');
            $table->foreignId('owner_id')->constrained('community_profiles')->cascadeOnDelete();
            $table->enum('gender', ['male', 'female'])->nullable();
            $table->enum('join_policy', ['open', 'approval'])->default('open');
            $table->boolean('posting_public')->default(true);
            $table->enum('posting_gender', ['any', 'male', 'female'])->nullable();
            $table->boolean('posting_requires_approval')->default(false);
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spaces');
    }
};
