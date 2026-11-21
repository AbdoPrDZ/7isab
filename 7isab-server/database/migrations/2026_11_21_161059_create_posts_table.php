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
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('space_id')->constrained('spaces')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('community_profiles')->cascadeOnDelete();
            $table->enum('type', ['text', 'ayah', 'hadith', 'testament', 'program', 'event']);
            $table->text('body');
            $table->json('payload')->nullable();
            $table->enum('audience', ['own_gender', 'everyone'])->default('everyone');
            $table->enum('status', ['published', 'pending', 'hidden'])->default('published');
            $table->timestamp('edited_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
