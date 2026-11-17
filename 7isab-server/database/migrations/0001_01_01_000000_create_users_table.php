<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->unique();
            // App users: hash of the client-derived auth key (never the real password).
            // Admins: hash of their panel password.
            $table->string('password');
            // Key-derivation parameters the client needs before login (algorithm, salt, cost).
            // Null for admin-only accounts that hold no encrypted data.
            $table->jsonb('kdf')->nullable();
            $table->boolean('is_active')->default(true);
            // Last sync sequence number given to this user's records (per-user counter).
            $table->unsignedBigInteger('sync_seq')->default(0);
            // Total size of this user's encrypted payloads, for admin stats.
            $table->unsignedBigInteger('storage_bytes')->default(0);
            $table->timestamp('last_login_at')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
