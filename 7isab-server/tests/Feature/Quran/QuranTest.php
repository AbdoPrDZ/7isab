<?php

namespace Tests\Feature\Quran;

use App\Models\Quran\Ayah;
use App\Models\Quran\Surah;
use App\Models\Quran\Word;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class QuranTest extends TestCase
{
    /**
     * Minimal fake of the quran.com API: 114 chapters, and page 1
     * (Al-Fatiha, ayahs 1–2) split over two result pages to exercise paging.
     */
    private function fakeSource(): void
    {
        $chapters = array_map(fn (int $id): array => [
            'id' => $id,
            'revelation_place' => $id === 2 ? 'madinah' : 'makkah',
            'revelation_order' => $id,
            'bismillah_pre' => $id !== 1 && $id !== 9,
            'name_simple' => "Surah {$id}",
            'name_arabic' => "سورة {$id}",
            'verses_count' => $id === 1 ? 7 : 10,
            'pages' => $id === 1 ? [1, 1] : [2, 3],
            'translated_name' => ['language_name' => 'english', 'name' => "Name {$id}"],
        ], range(1, 114));

        $verse = fn (int $id, int $number, array $words): array => [
            'id' => $id,
            'verse_number' => $number,
            'verse_key' => "1:{$number}",
            'chapter_id' => 1,
            'page_number' => 1,
            'juz_number' => 1,
            'hizb_number' => 1,
            'rub_el_hizb_number' => 1,
            'sajdah_number' => null,
            'text_uthmani' => implode(' ', array_column($words, 'text_uthmani')),
            'words' => $words,
        ];
        $word = fn (int $position, string $text, int $line, string $type = 'word'): array => [
            'position' => $position, 'char_type_name' => $type, 'text_uthmani' => $text, 'line_number' => $line, 'page_number' => 1,
        ];

        Http::fake([
            '*/chapters*' => Http::response(['chapters' => $chapters]),
            '*/verses/by_page/1?*page=1*' => Http::response([
                'verses' => [$verse(1, 1, [$word(1, 'بِسْمِ', 2), $word(2, 'ٱللَّهِ', 2), $word(3, '١', 2, 'end')])],
                'pagination' => ['next_page' => 2],
            ]),
            '*/verses/by_page/1?*page=2*' => Http::response([
                'verses' => [$verse(2, 2, [$word(1, 'ٱلْحَمْدُ', 3), $word(2, '٢', 3, 'end')])],
                'pagination' => ['next_page' => null],
            ]),
        ]);
    }

    public function test_import_command_saves_surahs_ayahs_and_words_and_is_rerunnable(): void
    {
        $this->fakeSource();

        $this->artisan('quran:import', ['--pages' => '1'])->assertSuccessful();
        $this->artisan('quran:import', ['--pages' => '1'])->assertSuccessful();

        $this->assertSame(114, Surah::count());
        $this->assertSame(2, Ayah::count());
        $this->assertSame(5, Word::count());
        $this->assertSame('madinah', Surah::find(2)->revelation_place);
        $this->assertFalse(Surah::find(1)->bismillah_pre);

        $end = Word::where('type', Word::TYPE_END)->orderBy('ayah_id')->first();
        $this->assertSame('١', $end->text);
        $this->assertSame(2, $end->line);
    }

    public function test_import_rejects_invalid_page_options(): void
    {
        Http::fake();

        $this->artisan('quran:import', ['--pages' => '0'])->assertFailed();
        $this->artisan('quran:import', ['--pages' => '605'])->assertFailed();
        $this->artisan('quran:import', ['--pages' => 'abc'])->assertFailed();

        Http::assertNothingSent();
    }

    public function test_meta_lists_surahs_and_juz_starts(): void
    {
        $this->fakeSource();
        $this->artisan('quran:import', ['--pages' => '1']);

        $this->getJson('/api/v1/quran/meta')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=86400, public')
            ->assertJsonPath('meta.pages', 604)
            ->assertJsonPath('meta.complete', false)
            ->assertJsonCount(114, 'meta.surahs')
            ->assertJsonPath('meta.surahs.0.name_arabic', 'سورة 1')
            ->assertJsonPath('meta.juz_starts.0', ['juz' => 1, 'page' => 1]);
    }

    public function test_meta_splits_each_quarter_into_two_eighths_at_the_nearest_ayah(): void
    {
        $this->fakeSource();
        $this->artisan('quran:import', ['--pages' => '1']);

        // Fake quarter 1: ayah 1:1 has 2 words, ayah 1:2 has 1 word (markers don't count).
        $this->getJson('/api/v1/quran/meta')
            ->assertOk()
            ->assertJsonPath('meta.divisions.quarters', [['key' => '1:1', 'page' => 1, 'words' => 3]])
            ->assertJsonPath('meta.divisions.eighths', [
                ['key' => '1:1', 'page' => 1, 'words' => 2],
                ['key' => '1:2', 'page' => 1, 'words' => 1],
            ]);
    }

    public function test_meta_is_unavailable_before_import(): void
    {
        $this->getJson('/api/v1/quran/meta')->assertStatus(503)->assertJsonPath('success', false);
    }

    public function test_page_groups_words_by_line_with_surah_starts(): void
    {
        $this->fakeSource();
        $this->artisan('quran:import', ['--pages' => '1']);

        $this->getJson('/api/v1/quran/pages/1')
            ->assertOk()
            ->assertJsonPath('page.number', 1)
            ->assertJsonPath('page.juz', 1)
            ->assertJsonPath('page.first_key', '1:1')
            ->assertJsonPath('page.last_key', '1:2')
            ->assertJsonPath('page.word_count', 3)
            ->assertJsonPath('page.surah_starts', [['surah_id' => 1, 'line' => 2]])
            ->assertJsonPath('page.lines.0.line', 2)
            ->assertJsonPath('page.lines.0.words.0', ['key' => '1:1', 'position' => 1, 'type' => 'word', 'text' => 'بِسْمِ'])
            ->assertJsonPath('page.lines.0.words.2.type', 'end')
            ->assertJsonPath('page.lines.1.line', 3);
    }

    public function test_page_bounds_and_missing_pages(): void
    {
        $this->getJson('/api/v1/quran/pages/0')->assertStatus(404);
        $this->getJson('/api/v1/quran/pages/605')->assertStatus(404);
        $this->getJson('/api/v1/quran/pages/10')->assertStatus(404)->assertJsonPath('success', false);
    }
}
