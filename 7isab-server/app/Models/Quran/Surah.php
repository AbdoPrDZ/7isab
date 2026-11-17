<?php

namespace App\Models\Quran;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name_arabic
 * @property string $name_simple
 * @property string $name_english
 * @property string $revelation_place
 * @property int $revelation_order
 * @property int $verses_count
 * @property int $page_start
 * @property int $page_end
 * @property bool $bismillah_pre
 */
#[Fillable(['id', 'name_arabic', 'name_simple', 'name_english', 'revelation_place', 'revelation_order', 'verses_count', 'page_start', 'page_end', 'bismillah_pre'])]
class Surah extends Model
{
    protected $table = 'quran_surahs';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'revelation_order' => 'integer',
            'verses_count' => 'integer',
            'page_start' => 'integer',
            'page_end' => 'integer',
            'bismillah_pre' => 'boolean',
        ];
    }

    public function ayahs(): HasMany
    {
        return $this->hasMany(Ayah::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name_arabic' => $this->name_arabic,
            'name_simple' => $this->name_simple,
            'name_english' => $this->name_english,
            'revelation_place' => $this->revelation_place,
            'verses_count' => $this->verses_count,
            'page_start' => $this->page_start,
            'page_end' => $this->page_end,
            'bismillah_pre' => $this->bismillah_pre,
        ];
    }
}
