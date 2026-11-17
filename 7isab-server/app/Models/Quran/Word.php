<?php

namespace App\Models\Quran;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One word (or ayah-end marker) at its place on the mushaf page.
 *
 * @property int $id
 * @property int $ayah_id
 * @property int $position
 * @property int $page
 * @property int $line
 * @property string $type 'word' | 'end'
 * @property string $text
 */
#[Fillable(['ayah_id', 'position', 'page', 'line', 'type', 'text'])]
class Word extends Model
{
    public const TYPE_WORD = 'word';

    public const TYPE_END = 'end';

    protected $table = 'quran_words';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'ayah_id' => 'integer',
            'position' => 'integer',
            'page' => 'integer',
            'line' => 'integer',
        ];
    }

    public function ayah(): BelongsTo
    {
        return $this->belongsTo(Ayah::class);
    }
}
