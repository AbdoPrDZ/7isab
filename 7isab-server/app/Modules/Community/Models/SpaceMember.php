<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpaceMember extends Model
{
    protected $table = 'space_members';

    protected $fillable = ['space_id', 'profile_id', 'role', 'status'];

    public function space(): BelongsTo
    {
        return $this->belongsTo(Space::class);
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }
}
