<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FatwaQuestion extends Model
{
    protected $table = 'fatwa_questions';

    protected $fillable = ['asker_id', 'shaykh_gender', 'target_shaykh_id', 'body', 'show_asker_gender', 'status'];

    public function asker(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }

    public function targetShaykh(): BelongsTo
    {
        return $this->belongsTo(Shaykh::class);
    }
}
