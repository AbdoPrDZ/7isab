<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A community rule shown on its own screen when joining; `texts` holds AR / EN / FR.
 */
class CommunityRule extends Model
{
    protected $table = 'community_rules';

    protected $fillable = ['key', 'version', 'order', 'texts'];

    protected $casts = [
        'version' => 'integer',
        'order' => 'integer',
        'texts' => 'array',
    ];
}
