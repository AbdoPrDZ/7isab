<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Quran text (Uthmani script, Madani mushaf layout), word by word.
 * Public reference data imported once with `php artisan quran:import`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quran_surahs', function (Blueprint $table) {
            $table->unsignedSmallInteger('id')->primary();
            $table->string('name_arabic');
            $table->string('name_simple');
            $table->string('name_english');
            $table->string('revelation_place', 16);
            $table->unsignedSmallInteger('revelation_order');
            $table->unsignedSmallInteger('verses_count');
            $table->unsignedSmallInteger('page_start');
            $table->unsignedSmallInteger('page_end');
            $table->boolean('bismillah_pre');
        });

        Schema::create('quran_ayahs', function (Blueprint $table) {
            // Global ayah number, 1..6236.
            $table->unsignedSmallInteger('id')->primary();
            $table->unsignedSmallInteger('surah_id');
            $table->unsignedSmallInteger('number');
            $table->string('key', 8)->unique();
            $table->unsignedSmallInteger('page')->index();
            $table->unsignedTinyInteger('juz');
            $table->unsignedTinyInteger('hizb');
            $table->unsignedSmallInteger('rub_el_hizb');
            $table->boolean('sajdah')->default(false);
            $table->text('text');

            $table->foreign('surah_id')->references('id')->on('quran_surahs')->cascadeOnDelete();
            $table->unique(['surah_id', 'number']);
        });

        Schema::create('quran_words', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('ayah_id');
            // Position inside the ayah, starting at 1.
            $table->unsignedSmallInteger('position');
            $table->unsignedSmallInteger('page');
            // Line on the mushaf page, 1..15.
            $table->unsignedTinyInteger('line');
            // 'word', or 'end' for the ayah-number marker.
            $table->string('type', 8);
            $table->string('text');

            $table->foreign('ayah_id')->references('id')->on('quran_ayahs')->cascadeOnDelete();
            $table->unique(['ayah_id', 'position']);
            $table->index(['page', 'line']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quran_words');
        Schema::dropIfExists('quran_ayahs');
        Schema::dropIfExists('quran_surahs');
    }
};
