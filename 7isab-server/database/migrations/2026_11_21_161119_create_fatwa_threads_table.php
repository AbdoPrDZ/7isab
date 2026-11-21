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
        Schema::create('fatwa_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('fatwa_questions')->cascadeOnDelete();
            $table->foreignId('shaykh_id')->constrained('shaykhs')->cascadeOnDelete();
            $table->enum('status', ['open', 'answered', 'declined', 'referred'])->default('open');
            $table->unique(['question_id', 'shaykh_id']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fatwa_threads');
    }
};
