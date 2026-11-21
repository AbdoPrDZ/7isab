<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A member hiding another member's content (a block works both ways). */
class Block extends Model
{
    protected $table = 'blocks';

    const UPDATED_AT = null;

    protected $fillable = ['profile_id', 'target_id'];

    public function target(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class, 'target_id');
    }
}
