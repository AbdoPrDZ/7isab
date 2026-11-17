<?php

namespace App\Modules\Quran\Console;

use App\Models\Quran\Ayah;
use App\Models\Quran\Surah;
use App\Models\Quran\Word;
use App\Modules\Quran\Http\Controllers\QuranController;
use App\Modules\Quran\Services\QuranImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * php artisan quran:import            all 604 pages
 * php artisan quran:import --pages=1-5 a range (or a list: 1,2,50)
 */
class ImportQuranCommand extends Command
{
    protected $signature = 'quran:import {--pages= : Pages to import, e.g. "1-604" or "1,2,50"}';

    protected $description = 'Import the Quran text (word by word, with mushaf page and line) from quran.com';

    public function handle(): int
    {
        $importer = QuranImporter::make();
        $pages = $this->pages();

        if ($pages === null) {
            $this->error('Invalid --pages value. Use e.g. "1-604" or "1,2,50" (pages 1 to 604).');

            return self::INVALID;
        }

        $this->info('Importing surahs…');
        $this->line('  '.$importer->importSurahs().' surahs');

        $this->info('Importing '.count($pages).' page(s)…');
        $bar = $this->output->createProgressBar(count($pages));
        $failed = [];

        foreach ($pages as $page) {
            try {
                $importer->importPage($page);
            } catch (Throwable $e) {
                $failed[$page] = $e->getMessage();
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        Cache::forget('quran.meta');
        Cache::forget(QuranController::META_CACHE_KEY);

        $this->table(['Surahs', 'Ayahs', 'Words'], [[Surah::count(), Ayah::count(), Word::count()]]);

        if ($failed) {
            foreach ($failed as $page => $message) {
                $this->error("Page {$page}: {$message}");
            }
            $this->warn('Re-run the command for the failed pages (it is safe to re-run).');

            return self::FAILURE;
        }

        $this->info('Done.');

        return self::SUCCESS;
    }

    /**
     * @return list<int>|null
     */
    private function pages(): ?array
    {
        $option = trim((string) $this->option('pages'));

        if ($option === '') {
            return range(1, QuranImporter::TOTAL_PAGES);
        }

        $pages = [];
        foreach (explode(',', $option) as $part) {
            if (preg_match('/^(\d+)-(\d+)$/', trim($part), $m)) {
                $pages = [...$pages, ...range((int) $m[1], (int) $m[2])];
            } elseif (ctype_digit(trim($part))) {
                $pages[] = (int) trim($part);
            } else {
                return null;
            }
        }

        $pages = array_values(array_unique($pages));
        sort($pages);

        foreach ($pages as $page) {
            if ($page < 1 || $page > QuranImporter::TOTAL_PAGES) {
                return null;
            }
        }

        return $pages;
    }
}
