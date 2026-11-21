<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Space extends Model
{
    protected $table = 'spaces';

    protected $fillable = ['type', 'name', 'slug', 'purpose', 'goals', 'content_plan', 'owner_id', 'gender', 'join_policy', 'posting_public', 'posting_gender', 'posting_requires_approval', 'status'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(SpaceMember::class);
    }
}
