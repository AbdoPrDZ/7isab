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
        Schema::create('program_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('community_profiles')->cascadeOnDelete();
            $table->string('name');
            $table->string('category');
            $table->string('custom_category')->nullable();
            $table->text('goal');
            $table->unsignedInteger('length');
            $table->json('tasks');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('program_templates');
    }
};
