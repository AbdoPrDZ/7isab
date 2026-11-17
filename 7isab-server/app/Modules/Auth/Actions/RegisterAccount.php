<?php

namespace App\Modules\Auth\Actions;

use App\Enums\UserKeyType;
use App\Models\User;
use App\Models\UserKey;
use Illuminate\Support\Facades\DB;

/**
 * Creates an app account with its locked data keys.
 *
 * Everything key-related arrives already encrypted from the device;
 * the server only stores it.
 */
class RegisterAccount
{
    /**
     * @param  array{
     *     name?: string|null,
     *     email: string,
     *     password: string,
     *     kdf: array<string, mixed>,
     *     keys: array{
     *         password: array{wrapped_key: string},
     *         recovery: array{wrapped_key: string, kdf: array<string, mixed>, auth: string},
     *     },
     * }  $data
     */
    public function handle(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $user = User::create([
                'name' => $data['name'] ?? null,
                'email' => $data['email'],
                'password' => $data['password'],
                'kdf' => $data['kdf'],
                'is_active' => true,
            ]);

            UserKey::create([
                'user_id' => $user->id,
                'type' => UserKeyType::Password,
                'wrapped_key' => $data['keys']['password']['wrapped_key'],
                'kdf' => $data['kdf'],
            ]);

            UserKey::create([
                'user_id' => $user->id,
                'type' => UserKeyType::Recovery,
                'wrapped_key' => $data['keys']['recovery']['wrapped_key'],
                'kdf' => $data['keys']['recovery']['kdf'],
                'auth_hash' => $data['keys']['recovery']['auth'],
            ]);

            return $user;
        });
    }
}
