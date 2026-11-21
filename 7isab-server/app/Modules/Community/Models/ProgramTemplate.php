<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramTemplate extends Model
{
    protected $table = 'program_templates';

    protected $fillable = ['author_id', 'name', 'category', 'custom_category', 'goal', 'length', 'tasks'];

    protected $casts = [
        'tasks' => 'json',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }
}
