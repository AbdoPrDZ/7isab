<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    protected $table = 'posts';

    protected $fillable = ['space_id', 'author_id', 'type', 'body', 'payload', 'audience', 'status', 'edited_at'];

    protected $casts = [
        'payload' => 'json',
        'edited_at' => 'datetime',
    ];

    /**
     * Published posts the profile may read: in an active space open to their
     * gender that they belong to (an active member or follower, the owner or a
     * moderator), and either for everyone or written by someone of their gender.
     */
    public function scopeVisibleTo(Builder $query, CommunityProfile $profile): Builder
    {
        return $query
            ->where('status', 'published')
            ->whereHas('space', fn (Builder $space) => $space
                ->where('status', 'active')
                ->where(fn (Builder $gender) => $gender->whereNull('gender')->orWhere('gender', $profile->gender))
                ->whereHas('members', fn (Builder $member) => $member
                    ->where('profile_id', $profile->id)
                    ->where('status', 'active')))
            ->where(fn (Builder $audience) => $audience
                ->where('audience', 'everyone')
                ->orWhereHas('author', fn (Builder $author) => $author->where('gender', $profile->gender)));
    }

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

    public function imports(): HasMany
    {
        return $this->hasMany(Import::class);
    }

    public function savedBy(): BelongsToMany
    {
        return $this->belongsToMany(CommunityProfile::class, 'saved_posts', 'post_id', 'profile_id');
    }
}
