<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A fatwa the shaykh proposed to publish (question and answer rewritten by him).
 * Public only once the asker approves the text too.
 */
class FatwaPublication extends Model
{
    protected $table = 'fatwa_publications';

    protected $fillable = ['thread_id', 'question_text', 'answer_text', 'shaykh_approved_at', 'asker_approved_at', 'published_at'];

    protected $casts = [
        'shaykh_approved_at' => 'datetime',
        'asker_approved_at' => 'datetime',
        'published_at' => 'datetime',
    ];

    /** Published fatwas of shaykhs the viewer may see (female shaykhs' fatwas are for women). */
    public function scopePublishedFor(Builder $query, CommunityProfile $viewer): Builder
    {
        return $query->whereNotNull('published_at')
            ->whereHas('thread.shaykh', fn (Builder $shaykh) => $shaykh->visibleTo($viewer));
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(FatwaThread::class, 'thread_id');
    }
}
