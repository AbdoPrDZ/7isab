<?php

namespace App\Modules\Auth\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\User;
use App\Models\UserKey;
use App\Modules\Auth\Actions\IssueAccessToken;
use App\Modules\Auth\Actions\ReplacePassword;
use App\Modules\Auth\Support\KdfParams;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Forgotten password, using the recovery key shown once at signup.
 *
 * 1. params: KDF parameters of the recovery lock (fake if unknown).
 * 2. unlock: the device proves it has the recovery key (recovery auth key)
 *    and receives the data key locked with it.
 * 3. reset:  the device sets a new password and re-locked data key.
 *
 * Without the recovery key, the data can't be recovered by anyone.
 */
class RecoveryController extends Controller
{
    private const DUMMY_HASH = '$2y$12$Kq7N2k1m3eQe3n0yq0b3wO2sK1pQf0nB7oM8tR5uV4wX3yZ2aB1cC';

    public function params(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email:rfc|max:255']);

        $key = $this->recoveryKeyFor($data['email']);

        return self::apiSuccessResponse('Recovery KDF parameters', [
            'kdf' => $key?->kdf ?? KdfParams::fakeFor($data['email'], 'recovery'),
        ]);
    }

    public function unlock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email:rfc|max:255',
            'recovery_auth' => 'required|string|max:255',
        ]);

        $key = $this->verifiedRecoveryKey($data['email'], $data['recovery_auth']);

        if (! $key) {
            return self::apiErrorResponse('Invalid email or recovery key.', code: 401);
        }

        return self::apiSuccessResponse('Recovery key accepted', ['key' => $key->toArray()]);
    }

    public function reset(Request $request, ReplacePassword $replacePassword, IssueAccessToken $issueToken): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email:rfc|max:255',
            'recovery_auth' => 'required|string|max:255',
            'password' => 'required|string|min:16|max:255',
            ...UserKey::kdfRules('kdf'),
            ...UserKey::envelopeRules('keys.password', withKdf: false),
            'keys.recovery' => 'sometimes|array',
            ...($request->has('keys.recovery') ? UserKey::envelopeRules('keys.recovery', withKdf: true, withAuth: true) : []),
            'device_name' => 'required|string|max:100',
        ]);

        $key = $this->verifiedRecoveryKey($data['email'], $data['recovery_auth']);

        if (! $key) {
            return self::apiErrorResponse('Invalid email or recovery key.', code: 401);
        }

        $user = $key->user;
        $replacePassword->handle($user, $data);
        $token = $issueToken->handle($user, IssueAccessToken::APP, $data['device_name']);

        return self::apiSuccessResponse('Password reset', [
            'token' => $token,
            'user' => $user->fresh()->toArray(),
            'key' => $user->passwordKey()->first()->toArray(),
        ]);
    }

    private function recoveryKeyFor(string $email): ?UserKey
    {
        $user = User::where('email', $email)->where('is_active', true)->first();

        return ($user && ! $user->isAdmin()) ? $user->recoveryKey : null;
    }

    private function verifiedRecoveryKey(string $email, string $recoveryAuth): ?UserKey
    {
        $key = $this->recoveryKeyFor($email);

        if (! $key || ! $key->auth_hash) {
            Hash::check($recoveryAuth, self::DUMMY_HASH);

            return null;
        }

        return Hash::check($recoveryAuth, $key->auth_hash) ? $key : null;
    }
}
