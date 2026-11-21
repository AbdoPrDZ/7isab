<?php

namespace App\Modules\Community\Services;

use App\Modules\Community\Models\Block;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Mute;

/**
 * Whose content a member doesn't see: people they muted, people they blocked,
 * and people who blocked them (a block works both ways).
 */
class Safety
{
    /**
     * Not cached: controllers (and so this service) can outlive a request.
     *
     * @return list<int>
     */
    public function hiddenAuthorIds(CommunityProfile $profile): array
    {
        return array_values(array_unique([
            ...Mute::where('profile_id', $profile->id)->pluck('target_id')->all(),
            ...Block::where('profile_id', $profile->id)->pluck('target_id')->all(),
            ...Block::where('target_id', $profile->id)->pluck('profile_id')->all(),
        ]));
    }

    public function isBlockedBetween(CommunityProfile $a, CommunityProfile $b): bool
    {
        return Block::where(fn ($q) => $q->where('profile_id', $a->id)->where('target_id', $b->id))
            ->orWhere(fn ($q) => $q->where('profile_id', $b->id)->where('target_id', $a->id))
            ->exists();
    }
}
