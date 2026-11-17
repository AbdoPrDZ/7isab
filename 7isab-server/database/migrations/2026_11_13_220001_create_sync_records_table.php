<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Encrypted record store for offline-first sync.
 * Every user record (ledger entry, account, task, ...) is one row with an
 * encrypted payload; the server only sees the metadata below.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Record ID generated on the device (UUID). Unique per user only.
            $table->uuid('uid');
            // Record kind as named by the client (e.g. "ledger_entry", "account").
            $table->string('type', 64);
            // Per-user sequence number assigned by the server on every change;
            // clients pull "changes since seq N".
            $table->unsignedBigInteger('seq');
            // Base64 ciphertext. Null once the record is deleted (tombstone).
            $table->text('payload')->nullable();
            $table->unsignedInteger('payload_size')->default(0);
            // Device time of the last edit; used for newest-edit-wins conflicts.
            $table->timestamp('client_updated_at', 3);
            // Tombstone: set when the client deletes the record, kept so deletions sync.
            $table->timestamp('client_deleted_at', 3)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'uid']);
            $table->unique(['user_id', 'seq']);
            $table->index(['user_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_records');
    }
};
