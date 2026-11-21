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
        Schema::create('space_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('community_profiles')->cascadeOnDelete();
            $table->enum('type', ['group', 'page']);
            $table->string('name');
            $table->text('purpose');
            $table->text('goals');
            $table->text('content_plan');
            $table->enum('join_policy', ['open', 'approval'])->nullable();
            $table->enum('audience', ['everyone', 'gender'])->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'changes_requested'])->default('pending');
            $table->text('admin_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('space_requests');
    }
};
