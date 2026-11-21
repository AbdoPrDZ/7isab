<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A group (one gender: the owner's, always) or a page (everyone, or the
 * owner's gender only). Created only from an approved request.
 */
class Space extends Model
{
    protected $table = 'spaces';

    protected $fillable = ['type', 'name', 'slug', 'purpose', 'goals', 'content_plan', 'owner_id', 'gender', 'join_policy', 'posting_public', 'posting_gender', 'posting_requires_approval', 'status'];

    protected $casts = [
        'posting_public' => 'boolean',
        'posting_requires_approval' => 'boolean',
    ];

    /** Active spaces the profile may find and read: open to everyone or to their gender. */
    public function scopeVisibleTo(Builder $query, CommunityProfile $profile): Builder
    {
        return $query
            ->where('status', 'active')
            ->where(fn (Builder $gender) => $gender->whereNull('gender')->orWhere('gender', $profile->gender));
    }

    public function isVisibleTo(CommunityProfile $profile): bool
    {
        return $this->status === 'active' && ($this->gender === null || $this->gender === $profile->gender);
    }

    public function membershipOf(CommunityProfile $profile): ?SpaceMember
    {
        return $this->members()->where('profile_id', $profile->id)->first();
    }

    /** The owner or an active moderator. */
    public function isManagedBy(CommunityProfile $profile): bool
    {
        return $this->members()
            ->where('profile_id', $profile->id)
            ->where('status', 'active')
            ->whereIn('role', ['owner', 'moderator'])
            ->exists();
    }

    /** Whether the profile is in this space: an active member or follower, the owner or a moderator. */
    public function hasActiveMember(CommunityProfile $profile): bool
    {
        return $this->members()->where('profile_id', $profile->id)->where('status', 'active')->exists();
    }

    /**
     * Whether the profile may post here (before approval):
     * groups: active members; pages: followers, within the owner's settings.
     * Only people in a space read its posts, so only they post in it.
     */
    public function allowsPostingBy(CommunityProfile $profile): bool
    {
        if (! $this->isVisibleTo($profile)) {
            return false;
        }

        $membership = $this->membershipOf($profile);

        // Not in the space, waiting for approval, or removed.
        if ($membership?->status !== 'active') {
            return false;
        }

        if ($this->type === 'group') {
            return $membership->role !== 'follower';
        }

        if ($this->isManagedBy($profile)) {
            return true;
        }

        return $this->posting_public
            && in_array($this->posting_gender, [null, 'any', $profile->gender], true);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(SpaceMember::class);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }
}
