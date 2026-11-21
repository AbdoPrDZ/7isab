<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A trusted shaykh: public manhaj and marja'. A female shaykh, her profile and
 * her fatwas are for women only; a male shaykh is open to everyone.
 */
class Shaykh extends Model
{
    protected $table = 'shaykhs';

    protected $fillable = ['profile_id', 'manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching', 'trusted_at', 'withdrawn_at'];

    protected $casts = [
        'trusted_at' => 'datetime',
        'withdrawn_at' => 'datetime',
    ];

    /** Shaykhs whose trust stands and whose community account is active. */
    public function scopeTrusted(Builder $query): Builder
    {
        return $query->whereNull('withdrawn_at')->whereHas('profile', fn (Builder $profile) => $profile->where('status', 'active'));
    }

    /** Trusted shaykhs the profile may see and ask: male shaykhs for everyone, female shaykhs for women. */
    public function scopeVisibleTo(Builder $query, CommunityProfile $viewer): Builder
    {
        return $query->trusted()->when($viewer->gender === 'male', fn (Builder $q) => $q->whereHas('profile', fn (Builder $profile) => $profile->where('gender', 'male')));
    }

    public function isTrusted(): bool
    {
        return $this->withdrawn_at === null && $this->profile?->status === 'active';
    }

    public function isVisibleTo(CommunityProfile $viewer): bool
    {
        return $this->isTrusted() && ($this->profile->gender === 'male' || $viewer->gender === 'female');
    }

    /** @return array<string, mixed> */
    public function publicData(): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->profile?->first_name,
            'last_name' => $this->profile?->last_name,
            'gender' => $this->profile?->gender,
            ...$this->only(['manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching', 'trusted_at']),
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function threads(): HasMany
    {
        return $this->hasMany(FatwaThread::class);
    }
}
