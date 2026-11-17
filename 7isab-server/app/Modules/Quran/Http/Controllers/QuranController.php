<?php

namespace App\Modules\Quran\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\Quran\Ayah;
use App\Models\Quran\Surah;
use App\Models\Quran\Word;
use App\Modules\Quran\Services\QuranDivisions;
use App\Modules\Quran\Services\QuranImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Public Quran text. The app downloads pages once and keeps them offline,
 * keyed by `version` so it can refresh if the dataset ever changes.
 */
class QuranController extends Controller
{
    /** Cached by clients for a day; the text itself never changes. */
    private const CACHE_SECONDS = 86400;

    /** Bumped when the meta shape changes, so an old cached copy is not served. */
    public const META_CACHE_KEY = 'quran.meta.v2';

    /** Surah list, page count, where each juz starts, and the quarters and eighths of the hizbs. */
    public function meta(): JsonResponse
    {
        $meta = Cache::rememberForever(self::META_CACHE_KEY, fn (): array => [
            'version' => (string) config('hisab.quran.version'),
            'pages' => QuranImporter::TOTAL_PAGES,
            'complete' => Ayah::count() === 6236,
            'surahs' => Surah::orderBy('id')->get()->toArray(),
            'juz_starts' => DB::table('quran_ayahs')
                ->selectRaw('juz, min(page) as page')
                ->groupBy('juz')
                ->orderBy('juz')
                ->get()
                ->map(fn ($row): array => ['juz' => (int) $row->juz, 'page' => (int) $row->page])
                ->all(),
            'divisions' => QuranDivisions::compute(),
        ]);

        if (! $meta['surahs']) {
            return self::apiErrorResponse('The Quran has not been imported yet.', code: 503);
        }

        return $this->cached(self::apiSuccessResponse('Quran metadata', ['meta' => $meta]));
    }

    /**
     * One mushaf page, grouped by line (1..15). Lines with no words are where
     * a surah header or the Bismillah goes; `surah_starts` says which.
     */
    public function page(int $page): JsonResponse
    {
        abort_if($page < 1 || $page > QuranImporter::TOTAL_PAGES, 404);

        $words = Word::query()
            ->join('quran_ayahs', 'quran_ayahs.id', '=', 'quran_words.ayah_id')
            ->where('quran_words.page', $page)
            ->orderBy('quran_words.line')
            ->orderBy('quran_words.ayah_id')
            ->orderBy('quran_words.position')
            ->get(['quran_words.line', 'quran_words.position', 'quran_words.type', 'quran_words.text', 'quran_ayahs.key', 'quran_ayahs.surah_id', 'quran_ayahs.number']);

        abort_if($words->isEmpty(), 404, 'This page has not been imported yet.');

        $lines = $words->groupBy('line')->map(fn ($lineWords, $line): array => [
            'line' => (int) $line,
            'words' => $lineWords->map(fn (Word $word): array => [
                'key' => $word->key,
                'position' => $word->position,
                'type' => $word->type,
                'text' => $word->text,
            ])->values()->all(),
        ])->values()->all();

        // Surahs whose first ayah is on this page, with the line it starts on.
        $surahStarts = $words
            ->filter(fn (Word $word): bool => (int) $word->number === 1 && $word->position === 1)
            ->map(fn (Word $word): array => ['surah_id' => (int) $word->surah_id, 'line' => (int) $word->line])
            ->values()
            ->all();

        $ayahs = Ayah::where('page', $page)->orderBy('id')->get(['key', 'juz', 'hizb', 'sajdah']);

        return $this->cached(self::apiSuccessResponse('Quran page', [
            'page' => [
                'number' => $page,
                'juz' => $ayahs->first()?->juz,
                'hizb' => $ayahs->first()?->hizb,
                'first_key' => $ayahs->first()?->key,
                'last_key' => $ayahs->last()?->key,
                'word_count' => $words->where('type', Word::TYPE_WORD)->count(),
                'surah_starts' => $surahStarts,
                'lines' => $lines,
            ],
        ]));
    }

    private function cached(JsonResponse $response): JsonResponse
    {
        return $response->setPublic()->setMaxAge(self::CACHE_SECONDS);
    }
}
