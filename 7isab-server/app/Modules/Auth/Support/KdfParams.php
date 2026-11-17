<?php

namespace App\Modules\Auth\Support;

use Illuminate\Support\Str;

/**
 * Key-derivation parameters handed to devices before login.
 *
 * Unknown emails get deterministic fake parameters that look like a real
 * account's, so the pre-login step can't be used to check which emails exist.
 */
final class KdfParams
{
    /** Parameters the app uses for new accounts (fake ones mimic these). */
    public const DEFAULT_ALGORITHM = 'scrypt';

    /** @var array<string, int> */
    public const DEFAULT_PARAMS = ['N' => 32768, 'r' => 8, 'p' => 1];

    /**
     * @return array{algorithm: string, salt: string, params: array<string, int>}
     */
    public static function fakeFor(string $email, string $purpose = 'login'): array
    {
        $digest = hash_hmac('sha256', $purpose.'|'.Str::lower(trim($email)), (string) config('app.key'), true);

        return [
            'algorithm' => self::DEFAULT_ALGORITHM,
            'salt' => base64_encode(substr($digest, 0, 16)),
            'params' => self::DEFAULT_PARAMS,
        ];
    }
}
