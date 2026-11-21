<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** One shaykh's conversation with the (hidden) asker about one question. */
class FatwaThread extends Model
{
    protected $table = 'fatwa_threads';

    protected $fillable = ['question_id', 'shaykh_id', 'status', 'referred_to_id', 'last_message_at'];

    protected $casts = [
        'last_message_at' => 'datetime',
    ];

    public function question(): BelongsTo
    {
        return $this->belongsTo(FatwaQuestion::class, 'question_id');
    }

    public function shaykh(): BelongsTo
    {
        return $this->belongsTo(Shaykh::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(FatwaMessage::class, 'thread_id')->orderBy('created_at')->orderBy('id');
    }

    public function publication(): HasOne
    {
        return $this->hasOne(FatwaPublication::class, 'thread_id');
    }
}
