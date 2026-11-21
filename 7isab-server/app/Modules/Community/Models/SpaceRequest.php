<?php

namespace App\Modules\Community\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpaceRequest extends Model
{
    protected $table = 'space_requests';

    protected $fillable = ['requester_id', 'type', 'name', 'purpose', 'goals', 'content_plan', 'join_policy', 'audience', 'status', 'admin_note', 'reviewed_by'];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
