<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestamentTemplate extends Model
{
    protected $table = 'testament_templates';

    protected $fillable = ['author_id', 'category', 'text', 'source'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }
}
