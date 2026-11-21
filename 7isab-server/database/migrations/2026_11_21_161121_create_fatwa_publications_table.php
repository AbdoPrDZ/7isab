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
        Schema::create('fatwa_publications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->unique()->constrained('fatwa_threads')->cascadeOnDelete();
            $table->text('question_text');
            $table->text('answer_text');
            $table->timestamp('shaykh_approved_at')->nullable();
            $table->timestamp('asker_approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fatwa_publications');
    }
};
