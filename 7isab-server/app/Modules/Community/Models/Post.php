<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    protected $table = 'posts';

    protected $fillable = ['space_id', 'author_id', 'type', 'body', 'payload', 'audience', 'status', 'edited_at'];

    public function space(): BelongsTo
    {
        return $this->belongsTo(Space::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }
}
