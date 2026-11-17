<?php

namespace App\Modules\Auth\Http\Controllers;

use App\Core\Enums\ValidationType;
use App\Core\Http\Controller;
use App\Models\User;
use App\Models\UserKey;
use App\Modules\Auth\Actions\IssueAccessToken;
use App\Modules\Auth\Actions\RegisterAccount;
use App\Modules\Auth\Actions\ReplacePassword;
use App\Modules\Auth\Support\KdfParams;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * App-user authentication (mobile app).
 *
 * The device never sends the real password: it derives an "auth key" from it
 * with the account's KDF parameters, and only that auth key is sent and hashed.
 * A separate key derived from the same password unlocks the data key, and it
 * never leaves the device.
 */
class AuthController extends Controller
{
    /** Used to keep timing similar when the email doesn't exist. */
    private const DUMMY_HASH = '$2y$12$Kq7N2k1m3eQe3n0yq0b3wO2sK1pQf0nB7oM8tR5uV4wX3yZ2aB1cC';

    /**
     * Step 1 of login: the KDF parameters for an email (fake ones if unknown).
     */
    public function prelogin(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email:rfc|max:255']);

        $user = User::where('email', $data['email'])->first();
        $kdf = ($user && $user->kdf && ! $user->isAdmin()) ? $user->kdf : KdfParams::fakeFor($data['email']);

        return self::apiSuccessResponse('KDF parameters', ['kdf' => $kdf]);
    }

    public function register(Request $request, RegisterAccount $register, IssueAccessToken $issueToken): JsonResponse
    {
        $data = $request->validate([
            ...User::validationRules(ValidationType::Create),
            'password' => 'required|string|min:16|max:255',
            ...UserKey::kdfRules('kdf'),
            ...UserKey::envelopeRules('keys.password', withKdf: false),
            ...UserKey::envelopeRules('keys.recovery', withKdf: true, withAuth: true),
            'device_name' => 'required|string|max:100',
        ]);

        $user = $register->handle($data);
        $token = $issueToken->handle($user, IssueAccessToken::APP, $data['device_name']);

        return self::apiSuccessResponse('Account created', [
            'token' => $token,
            'user' => $user->fresh()->toArray(),
            'key' => $user->passwordKey->toArray(),
        ], 201);
    }

    /**
     * Step 2 of login: email + auth key. Returns a token and the locked data key.
     */
    public function login(Request $request, IssueAccessToken $issueToken): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email:rfc|max:255',
            'password' => 'required|string|max:255',
            'device_name' => 'required|string|max:100',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! $user->kdf || $user->isAdmin()) {
            Hash::check($data['password'], self::DUMMY_HASH);

            return self::apiErrorResponse('Invalid email or password.', code: 401);
        }

        if (! Hash::check($data['password'], $user->password)) {
            return self::apiErrorResponse('Invalid email or password.', code: 401);
        }

        if (! $user->is_active) {
            return self::apiErrorResponse('This account is disabled.', code: 403);
        }

        $token = $issueToken->handle($user, IssueAccessToken::APP, $data['device_name']);

        return self::apiSuccessResponse('Signed in', [
            'token' => $token,
            'user' => $user->fresh()->toArray(),
            'key' => $user->passwordKey?->toArray(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return self::apiSuccessResponse('Current user', ['user' => $request->user()->toArray()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return self::apiSuccessResponse('Signed out');
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return self::apiSuccessResponse('Signed out on all devices');
    }

    /**
     * New password: the device re-derives keys and re-locks the data key.
     * Other devices are signed out.
     */
    public function changePassword(Request $request, ReplacePassword $replacePassword): JsonResponse
    {
        $data = $request->validate([
            'current_password' => 'required|string|max:255',
            'password' => 'required|string|min:16|max:255|different:current_password',
            ...UserKey::kdfRules('kdf'),
            ...UserKey::envelopeRules('keys.password', withKdf: false),
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            return self::apiSingleErrorResponse('current_password', 'The current password is incorrect.');
        }

        $replacePassword->handle($user, $data, keepTokenId: $user->currentAccessToken()->id);

        return self::apiSuccessResponse('Password changed', ['key' => $user->passwordKey()->first()->toArray()]);
    }
}
