<?php

namespace App\Modules\Community\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityProfile extends Model
{
    protected $table = 'community_profiles';

    protected $fillable = ['user_id', 'first_name', 'last_name', 'gender', 'status', 'rules_version', 'joined_at'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
