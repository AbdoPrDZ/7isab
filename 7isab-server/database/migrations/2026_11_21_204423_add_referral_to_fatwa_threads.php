<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A shaykh can refer a question to another shaykh (a new thread for them), and
 * threads are listed by their latest message.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fatwa_threads', function (Blueprint $table) {
            $table->foreignId('referred_to_id')->nullable()->after('status')->constrained('shaykhs')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable()->after('referred_to_id');
        });
    }

    public function down(): void
    {
        Schema::table('fatwa_threads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('referred_to_id');
            $table->dropColumn('last_message_at');
        });
    }
};
