<?php

namespace App\Models;

use App\Core\Enums\ValidationType;
use App\Core\Models\Concerns\Tabling;
use App\Enums\Role;
use App\Enums\UserKeyType;
use App\Modules\Community\Models\CommunityProfile;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * An account. App users own encrypted data (kdf set, no role);
 * admins manage accounts from the panel (role set, kdf usually null).
 *
 * @property int $id
 * @property string|null $name
 * @property string $email
 * @property array|null $kdf
 * @property bool $is_active
 * @property int $sync_seq
 * @property int $storage_bytes
 * @property Carbon|null $last_login_at
 * @property Carbon|null $last_sync_at
 */
#[Fillable(['name', 'email', 'password', 'kdf', 'is_active'])]
#[Hidden(['password', 'remember_token', 'sync_seq'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable, SoftDeletes, Tabling;

    /** Spatie roles are checked on the sanctum guard used by the API. */
    protected string $guard_name = 'sanctum';

    protected $sortable = ['id', 'name', 'email', 'is_active', 'storage_bytes', 'last_login_at', 'last_sync_at', 'created_at'];

    protected $filterable = ['name', 'email'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'kdf' => 'array',
            'is_active' => 'boolean',
            'sync_seq' => 'integer',
            'storage_bytes' => 'integer',
            'last_login_at' => 'datetime',
            'last_sync_at' => 'datetime',
        ];
    }

    public static function validationRules(ValidationType $type, ?EloquentModel $record = null): array
    {
        return match ($type) {
            ValidationType::Create => [
                'name' => 'nullable|string|max:100',
                'email' => 'required|email:rfc|max:255|unique:users,email',
                'password' => 'required|string|min:8|max:255',
            ],
            ValidationType::Update => [
                'name' => 'sometimes|nullable|string|max:100',
                'email' => ['sometimes', 'required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($record?->getKey())],
                'is_active' => 'sometimes|boolean',
            ],
        };
    }

    public function keys(): HasMany
    {
        return $this->hasMany(UserKey::class);
    }

    public function passwordKey(): HasOne
    {
        return $this->hasOne(UserKey::class)->where('type', UserKeyType::Password);
    }

    public function recoveryKey(): HasOne
    {
        return $this->hasOne(UserKey::class)->where('type', UserKeyType::Recovery);
    }

    public function syncRecords(): HasMany
    {
        return $this->hasMany(SyncRecord::class);
    }

    public function communityProfile(): HasOne
    {
        return $this->hasOne(CommunityProfile::class);
    }

    public function isAdmin(): bool
    {
        return $this->hasAnyRole(Role::values());
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(Role::SuperAdmin->value);
    }

    /** Public account metadata. Never includes encrypted data or key material. */
    public function toArray(): array
    {
        return $this->mergeArrayableRelations([
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_active' => $this->is_active,
            'storage_bytes' => $this->storage_bytes,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'last_sync_at' => $this->last_sync_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ]);
    }
}
