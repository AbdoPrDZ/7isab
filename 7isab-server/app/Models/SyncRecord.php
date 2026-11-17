<?php

namespace App\Models;

use App\Core\Enums\ValidationType;
use App\Core\Models\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One encrypted user record. The payload is ciphertext produced on the device.
 *
 * @property int $id
 * @property int $user_id
 * @property string $uid
 * @property string $type
 * @property int $seq
 * @property string|null $payload
 * @property int $payload_size
 * @property Carbon $client_updated_at
 * @property Carbon|null $client_deleted_at
 */
#[Fillable(['user_id', 'uid', 'type', 'seq', 'payload', 'payload_size', 'client_updated_at', 'client_deleted_at'])]
class SyncRecord extends Model
{
    /** Largest encrypted payload accepted for one record (base64 characters). */
    public const MAX_PAYLOAD_LENGTH = 262144;

    protected function casts(): array
    {
        return [
            'seq' => 'integer',
            'payload_size' => 'integer',
            'client_updated_at' => 'datetime',
            'client_deleted_at' => 'datetime',
        ];
    }

    /**
     * Rules for one pushed change (prefixed, e.g. "records.*").
     * Times are milliseconds since the epoch, as the app stores them.
     */
    public static function changeRules(string $prefix): array
    {
        return [
            "$prefix.id" => 'required|uuid',
            "$prefix.type" => 'required|string|max:64|regex:/^[a-z][a-z0-9_]*$/',
            "$prefix.payload" => 'nullable|required_without:'.$prefix.'.deleted_at|string|max:'.self::MAX_PAYLOAD_LENGTH,
            "$prefix.updated_at" => 'required|integer|min:0',
            "$prefix.deleted_at" => 'nullable|integer|min:0',
        ];
    }

    /** Milliseconds since the epoch, as the app uses them. */
    public static function toMillis(?Carbon $time): ?int
    {
        return $time ? (int) $time->getPreciseTimestamp(3) : null;
    }

    public static function fromMillis(?int $millis): ?Carbon
    {
        return $millis === null ? null : Carbon::createFromTimestampMs($millis, 'UTC');
    }

    public static function validationRules(ValidationType $type, ?EloquentModel $record = null): array
    {
        return self::changeRules('record');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isDeleted(): bool
    {
        return $this->client_deleted_at !== null;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->uid,
            'type' => $this->type,
            'seq' => $this->seq,
            'payload' => $this->payload,
            'updated_at' => self::toMillis($this->client_updated_at),
            'deleted_at' => self::toMillis($this->client_deleted_at),
        ];
    }
}
