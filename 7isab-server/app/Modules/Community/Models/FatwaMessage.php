<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A message in a fatwa thread, from the asker or the shaykh. */
class FatwaMessage extends Model
{
    protected $table = 'fatwa_messages';

    const UPDATED_AT = null;

    protected $fillable = ['thread_id', 'from', 'body'];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(FatwaThread::class, 'thread_id');
    }
}
