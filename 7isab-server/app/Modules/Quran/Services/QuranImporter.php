<?php

namespace App\Modules\Quran\Services;

use App\Models\Quran\Ayah;
use App\Models\Quran\Surah;
use App\Models\Quran\Word;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Imports the Quran (Uthmani text, Madani mushaf page/line layout) from the
 * quran.com API v4. Safe to re-run: every row is upserted.
 */
class QuranImporter
{
    public const TOTAL_PAGES = 604;

    public function __construct(private readonly string $baseUrl) {}

    public static function make(): self
    {
        return new self(rtrim((string) config('hisab.quran.source_url'), '/'));
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl)->acceptJson()->timeout(30)->retry(3, 1000);
    }

    /** Imports the 114 surahs. Returns how many were saved. */
    public function importSurahs(): int
    {
        $chapters = $this->http()->get('/chapters', ['language' => 'en'])->throw()->json('chapters');

        if (! is_array($chapters) || count($chapters) !== 114) {
            throw new RuntimeException('Unexpected chapters response from the Quran source.');
        }

        $rows = array_map(fn (array $chapter): array => [
            'id' => $chapter['id'],
            'name_arabic' => $chapter['name_arabic'],
            'name_simple' => $chapter['name_simple'],
            'name_english' => $chapter['translated_name']['name'] ?? $chapter['name_simple'],
            'revelation_place' => $chapter['revelation_place'],
            'revelation_order' => $chapter['revelation_order'],
            'verses_count' => $chapter['verses_count'],
            'page_start' => $chapter['pages'][0],
            'page_end' => $chapter['pages'][1],
            'bismillah_pre' => (bool) $chapter['bismillah_pre'],
        ], $chapters);

        Surah::upsert($rows, ['id']);

        return count($rows);
    }

    /**
     * Imports one mushaf page: its ayahs and words with line numbers.
     *
     * @return array{ayahs: int, words: int}
     */
    public function importPage(int $page): array
    {
        $verses = [];
        $current = 1;

        do {
            $response = $this->http()->get("/verses/by_page/{$page}", [
                'words' => 'true',
                'word_fields' => 'text_uthmani,line_number,page_number',
                'fields' => 'text_uthmani,chapter_id,page_number,juz_number,hizb_number,rub_el_hizb_number,sajdah_number',
                'per_page' => 50,
                'page' => $current,
            ])->throw();

            $verses = [...$verses, ...$response->json('verses', [])];
            $next = $response->json('pagination.next_page');
            $current++;
        } while ($next);

        if ($verses === []) {
            throw new RuntimeException("No verses returned for page {$page}.");
        }

        $ayahRows = [];
        $wordRows = [];

        foreach ($verses as $verse) {
            [$surahId, $number] = array_map('intval', explode(':', $verse['verse_key']));

            $ayahRows[] = [
                'id' => $verse['id'],
                'surah_id' => $verse['chapter_id'] ?? $surahId,
                'number' => $number,
                'key' => $verse['verse_key'],
                'page' => $verse['page_number'],
                'juz' => $verse['juz_number'],
                'hizb' => $verse['hizb_number'],
                'rub_el_hizb' => $verse['rub_el_hizb_number'],
                'sajdah' => ! empty($verse['sajdah_number']),
                'text' => trim($verse['text_uthmani']),
            ];

            foreach ($verse['words'] as $word) {
                $wordRows[] = [
                    'ayah_id' => $verse['id'],
                    'position' => $word['position'],
                    'page' => $word['page_number'],
                    'line' => $word['line_number'],
                    'type' => $word['char_type_name'] === Word::TYPE_END ? Word::TYPE_END : Word::TYPE_WORD,
                    'text' => $word['text_uthmani'],
                ];
            }
        }

        DB::transaction(function () use ($ayahRows, $wordRows): void {
            Ayah::upsert($ayahRows, ['id']);
            Word::upsert($wordRows, ['ayah_id', 'position'], ['page', 'line', 'type', 'text']);
        });

        return ['ayahs' => count($ayahRows), 'words' => count($wordRows)];
    }
}
