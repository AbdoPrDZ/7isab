<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shaykh extends Model
{
    protected $table = 'shaykhs';

    protected $fillable = ['profile_id', 'manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching', 'trusted_at', 'withdrawn_at'];

    protected $casts = ['trusted_at' => 'datetime', 'withdrawn_at' => 'datetime'];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }
}
