<?php

namespace App\Models\Quran;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id global ayah number (1..6236)
 * @property int $surah_id
 * @property int $number ayah number inside the surah
 * @property string $key e.g. "2:255"
 * @property int $page
 * @property int $juz
 * @property int $hizb
 * @property int $rub_el_hizb
 * @property bool $sajdah
 * @property string $text
 */
#[Fillable(['id', 'surah_id', 'number', 'key', 'page', 'juz', 'hizb', 'rub_el_hizb', 'sajdah', 'text'])]
class Ayah extends Model
{
    protected $table = 'quran_ayahs';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'surah_id' => 'integer',
            'number' => 'integer',
            'page' => 'integer',
            'juz' => 'integer',
            'hizb' => 'integer',
            'rub_el_hizb' => 'integer',
            'sajdah' => 'boolean',
        ];
    }

    public function surah(): BelongsTo
    {
        return $this->belongsTo(Surah::class);
    }

    public function words(): HasMany
    {
        return $this->hasMany(Word::class)->orderBy('position');
    }
}
