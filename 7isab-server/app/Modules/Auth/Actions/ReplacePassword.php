<?php

namespace App\Modules\Auth\Actions;

use App\Enums\UserKeyType;
use App\Models\User;
use App\Models\UserKey;
use Illuminate\Support\Facades\DB;

/**
 * Sets a new password and re-locked data key, then signs out other sessions.
 *
 * Used by "change password" (signed in) and "reset with recovery key".
 * The data itself is not re-encrypted: only the data key's lock changes.
 */
class ReplacePassword
{
    /**
     * @param  array{
     *     password: string,
     *     kdf: array<string, mixed>,
     *     keys: array{
     *         password: array{wrapped_key: string},
     *         recovery?: array{wrapped_key: string, kdf: array<string, mixed>, auth: string},
     *     },
     * }  $data
     * @param  int|null  $keepTokenId  token to keep signed in (the one making the request)
     */
    public function handle(User $user, array $data, ?int $keepTokenId = null): void
    {
        DB::transaction(function () use ($user, $data, $keepTokenId): void {
            $user->forceFill([
                'password' => $data['password'],
                'kdf' => $data['kdf'],
            ])->save();

            $this->replaceKey($user, UserKeyType::Password, [
                'wrapped_key' => $data['keys']['password']['wrapped_key'],
                'kdf' => $data['kdf'],
            ]);

            if (isset($data['keys']['recovery'])) {
                $this->replaceKey($user, UserKeyType::Recovery, [
                    'wrapped_key' => $data['keys']['recovery']['wrapped_key'],
                    'kdf' => $data['keys']['recovery']['kdf'],
                    'auth_hash' => $data['keys']['recovery']['auth'],
                ]);
            }

            $user->tokens()
                ->when($keepTokenId, fn ($query) => $query->whereKeyNot($keepTokenId))
                ->delete();
        });
    }

    /**
     * Replaces one key envelope and bumps its version.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function replaceKey(User $user, UserKeyType $type, array $attributes): UserKey
    {
        $key = UserKey::firstOrNew(['user_id' => $user->id, 'type' => $type]);
        $key->fill($attributes);
        $key->version = $key->exists ? $key->version + 1 : 1;
        $key->save();

        return $key;
    }
}
