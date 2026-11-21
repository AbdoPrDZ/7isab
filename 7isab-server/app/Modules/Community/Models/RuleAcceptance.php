<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RuleAcceptance extends Model
{
    protected $table = 'rule_acceptances';

    public $timestamps = false;

    protected $fillable = ['profile_id', 'rule_key', 'version', 'accepted_at'];

    protected $casts = [
        'version' => 'integer',
        'accepted_at' => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }
}
