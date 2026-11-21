<?php

namespace App\Modules\Community\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A member's report of a post, comment, profile or space, for the admin queue. */
class Report extends Model
{
    /** `fatwa` is a published fatwa; `fatwa_question` is reported by a shaykh who received it (admins then see the asker). */
    public const TARGETS = ['post', 'comment', 'profile', 'space', 'fatwa', 'fatwa_question'];

    public const REASONS = ['off_purpose', 'fitna', 'haram', 'hadith_source', 'ads', 'fake_name', 'abuse', 'other'];

    protected $table = 'reports';

    protected $fillable = ['reporter_id', 'target_type', 'target_id', 'reason', 'details', 'revealed_content', 'status', 'handled_by'];

    protected $casts = [
        'revealed_content' => 'array',
    ];

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class, 'reporter_id');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
