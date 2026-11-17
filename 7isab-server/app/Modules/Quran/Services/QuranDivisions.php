<?php

namespace App\Modules\Quran\Services;

use Illuminate\Support\Facades\DB;

/**
 * Where each rub' al-hizb (quarter, 240) and thumn (eighth, 480) starts, with
 * its word count. A hizb is 4 quarters (8 eighths).
 *
 * Quarters come from the source data (quran.com rub_el_hizb_number). Eighths
 * are not marked in this mushaf: each quarter is split in two at the ayah
 * boundary closest to half of its words, so an eighth may differ by an ayah
 * from a printed Maghrebi (Warsh) mushaf.
 */
class QuranDivisions
{
    /**
     * @return array{quarters: list<array{key: string, page: int, words: int}>, eighths: list<array{key: string, page: int, words: int}>}
     */
    public static function compute(): array
    {
        $ayahs = DB::table('quran_ayahs')
            ->leftJoin('quran_words', function ($join): void {
                $join->on('quran_words.ayah_id', '=', 'quran_ayahs.id')->where('quran_words.type', '=', 'word');
            })
            ->groupBy('quran_ayahs.id', 'quran_ayahs.key', 'quran_ayahs.page', 'quran_ayahs.rub_el_hizb')
            ->orderBy('quran_ayahs.id')
            ->get([
                'quran_ayahs.id',
                'quran_ayahs.key',
                'quran_ayahs.page',
                'quran_ayahs.rub_el_hizb',
                DB::raw('count(quran_words.id) as words'),
            ]);

        /** @var array<int, list<object>> $byQuarter */
        $byQuarter = [];
        foreach ($ayahs as $ayah) {
            $byQuarter[(int) $ayah->rub_el_hizb][] = $ayah;
        }
        ksort($byQuarter);

        $quarters = [];
        $eighths = [];
        foreach ($byQuarter as $list) {
            $total = array_sum(array_map(fn (object $ayah): int => (int) $ayah->words, $list));
            $quarters[] = self::division($list[0], $total);

            // Second eighth: the ayah start whose words-before is closest to half.
            $split = 0;
            $before = 0;
            $best = PHP_INT_MAX;
            foreach ($list as $index => $ayah) {
                if ($index > 0 && abs($before * 2 - $total) < $best) {
                    $best = abs($before * 2 - $total);
                    $split = $index;
                }
                $before += (int) $ayah->words;
            }

            if ($split === 0) {
                // A quarter of a single ayah can't be split: both eighths start there.
                $eighths[] = self::division($list[0], $total);
                $eighths[] = self::division($list[0], 0);

                continue;
            }

            $firstWords = array_sum(array_map(fn (object $ayah): int => (int) $ayah->words, array_slice($list, 0, $split)));
            $eighths[] = self::division($list[0], $firstWords);
            $eighths[] = self::division($list[$split], $total - $firstWords);
        }

        return ['quarters' => $quarters, 'eighths' => $eighths];
    }

    /** @return array{key: string, page: int, words: int} */
    private static function division(object $ayah, int $words): array
    {
        return ['key' => (string) $ayah->key, 'page' => (int) $ayah->page, 'words' => $words];
    }
}
