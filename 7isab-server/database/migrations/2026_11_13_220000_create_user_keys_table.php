<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vault: the user's data key (DEK), locked on the device before upload.
 * The server stores opaque ciphertext only and can never unlock it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // 'password' = DEK locked with the password-derived key,
            // 'recovery' = DEK locked with the recovery-key-derived key.
            $table->string('type', 16);
            // Base64 ciphertext (nonce + sealed DEK), produced on the device.
            $table->text('wrapped_key');
            // Key-derivation parameters for this lock (recovery key has its own salt).
            $table->jsonb('kdf')->nullable();
            // Recovery only: hash of the recovery auth key, so the server can verify
            // a recovery request without ever seeing the recovery key itself.
            $table->string('auth_hash')->nullable();
            // Bumped every time the lock is replaced (password change, recovery).
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['user_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_keys');
    }
};
