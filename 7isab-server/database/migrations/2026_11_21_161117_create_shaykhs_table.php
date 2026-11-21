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
        Schema::create('shaykhs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->unique()->constrained('community_profiles')->cascadeOnDelete();
            $table->text('manhaj');
            $table->text('marja');
            $table->text('studies')->nullable();
            $table->text('ijazat')->nullable();
            $table->text('teachers')->nullable();
            $table->text('institution')->nullable();
            $table->text('teaching')->nullable();
            $table->timestamp('trusted_at');
            $table->timestamp('withdrawn_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shaykhs');
    }
};
