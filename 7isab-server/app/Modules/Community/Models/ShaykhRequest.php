<?php

namespace App\Modules\Community\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A member's request to become a trusted shaykh (one per member, resubmitted after a rejection). */
class ShaykhRequest extends Model
{
    public const FIELDS = ['manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching'];

    protected $table = 'shaykh_requests';

    protected $fillable = ['profile_id', 'manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching', 'status', 'admin_note'];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(CommunityProfile::class);
    }
}
