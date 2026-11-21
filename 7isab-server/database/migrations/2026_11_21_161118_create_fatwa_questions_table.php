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
        Schema::create('fatwa_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asker_id')->nullable()->constrained('community_profiles')->nullOnDelete();
            $table->enum('shaykh_gender', ['male', 'female']);
            $table->foreignId('target_shaykh_id')->nullable()->constrained('shaykhs')->nullOnDelete();
            $table->text('body');
            $table->boolean('show_asker_gender')->default(false);
            $table->enum('status', ['open', 'answered', 'closed'])->default('open');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fatwa_questions');
    }
};
