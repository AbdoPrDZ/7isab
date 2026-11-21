<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A member hiding another member's content from themselves only. */
class Mute extends Model
{
    protected $table = 'mutes';

    const UPDATED_AT = null;

    protected $fillable = ['profile_id', 'target_id'];

    public function target(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class, 'target_id');
    }
}
