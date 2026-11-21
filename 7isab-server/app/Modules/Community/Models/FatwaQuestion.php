<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A question to the trusted shaykhs of one gender (open) or to one shaykh.
 * The asker is never shown to shaykhs or the public; only admins see it, from a report.
 */
class FatwaQuestion extends Model
{
    protected $table = 'fatwa_questions';

    protected $fillable = ['asker_id', 'shaykh_gender', 'target_shaykh_id', 'body', 'show_asker_gender', 'status'];

    protected $casts = [
        'show_asker_gender' => 'boolean',
    ];

    public function asker(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function targetShaykh(): BelongsTo
    {
        return $this->belongsTo(Shaykh::class);
    }

    public function threads(): HasMany
    {
        return $this->hasMany(FatwaThread::class, 'question_id');
    }

    /** "A brother" / "a sister" when the asker chose to show it; never a name. */
    public function askerGenderLabel(): ?string
    {
        return $this->show_asker_gender ? $this->asker?->gender : null;
    }
}
