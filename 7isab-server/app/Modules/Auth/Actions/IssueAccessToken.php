<?php

namespace App\Modules\Auth\Actions;

use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Creates a Sanctum token for one client and records the login.
 *
 * App tokens carry the "app" ability and don't expire (the app works offline
 * for long periods). Admin tokens carry "admin" and expire.
 */
class IssueAccessToken
{
    public const APP = 'app';

    public const ADMIN = 'admin';

    public function handle(User $user, string $ability, string $deviceName): string
    {
        $expiresAt = $ability === self::ADMIN
            ? Carbon::now()->addMinutes((int) config('hisab.admin_token_ttl'))
            : null;

        $token = $user->createToken($deviceName, [$ability], $expiresAt);

        $user->forceFill(['last_login_at' => Carbon::now()])->saveQuietly();

        return $token->plainTextToken;
    }
}
