<?php

namespace App\Models;

use App\Core\Enums\ValidationType;
use App\Core\Models\Model;
use App\Enums\UserKeyType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The user's data key, locked on the device. Opaque to the server.
 *
 * @property int $id
 * @property int $user_id
 * @property UserKeyType $type
 * @property string $wrapped_key
 * @property array|null $kdf
 * @property string|null $auth_hash
 * @property int $version
 */
#[Fillable(['user_id', 'type', 'wrapped_key', 'kdf', 'auth_hash', 'version'])]
#[Hidden(['auth_hash'])]
class UserKey extends Model
{
    protected function casts(): array
    {
        return [
            'type' => UserKeyType::class,
            'kdf' => 'array',
            'auth_hash' => 'hashed',
            'version' => 'integer',
        ];
    }

    /**
     * Rules for a key envelope sent by the client, under a request prefix
     * (e.g. "keys.password").
     *
     * @param  bool  $withKdf  the envelope carries its own key-derivation parameters
     * @param  bool  $withAuth  the envelope carries an auth key (recovery only)
     * @return array<string, string>
     */
    public static function envelopeRules(string $prefix, bool $withKdf = true, bool $withAuth = false): array
    {
        $rules = [
            "$prefix" => 'required|array',
            "$prefix.wrapped_key" => 'required|string|max:4096',
        ];

        if ($withKdf) {
            $rules += self::kdfRules("$prefix.kdf");
        }

        if ($withAuth) {
            $rules["$prefix.auth"] = 'required|string|min:16|max:255';
        }

        return $rules;
    }

    /**
     * Rules for key-derivation parameters (algorithm, salt, cost).
     *
     * @return array<string, string>
     */
    public static function kdfRules(string $prefix = 'kdf'): array
    {
        return [
            "$prefix" => 'required|array',
            "$prefix.algorithm" => 'required|string|in:scrypt,argon2id',
            "$prefix.salt" => 'required|string|min:16|max:255',
            "$prefix.params" => 'required|array',
        ];
    }

    public static function validationRules(ValidationType $type, ?EloquentModel $record = null): array
    {
        return self::envelopeRules('key');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** What the device needs to unlock its data key. */
    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'wrapped_key' => $this->wrapped_key,
            'kdf' => $this->kdf,
            'version' => $this->version,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
