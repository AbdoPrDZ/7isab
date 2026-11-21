<?php

namespace App\Modules\Community\Models;

use App\Core\Models\Concerns\Tabling;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user's community identity: public names, and gender (decides every
 * separation rule, never shown as a field). Status: active, suspended, left, banned.
 */
class CommunityProfile extends Model
{
    use Tabling;

    protected $table = 'community_profiles';

    protected $fillable = ['user_id', 'first_name', 'last_name', 'gender', 'status', 'rules_version', 'joined_at'];

    protected $casts = [
        'joined_at' => 'datetime',
    ];

    /** @var list<string> */
    protected array $sortable = ['first_name', 'last_name', 'gender', 'status', 'joined_at', 'created_at'];

    /** Searched by name; gender and status are exact filters in the admin controller. */
    protected array $filterable = ['first_name', 'last_name'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
