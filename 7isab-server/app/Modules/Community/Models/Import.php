<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Import extends Model
{
    protected $table = 'imports';

    public $timestamps = false;

    protected $fillable = ['profile_id', 'post_id', 'imported_at'];

    protected $casts = [
        'imported_at' => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
