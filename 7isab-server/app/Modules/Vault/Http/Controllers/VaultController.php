<?php

namespace App\Modules\Vault\Http\Controllers;

use App\Core\Http\Controller;
use App\Enums\UserKeyType;
use App\Models\UserKey;
use App\Modules\Auth\Actions\ReplacePassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * The signed-in user's locked data key. The server can't open it.
 */
class VaultController extends Controller
{
    /** The password-locked data key, for unlocking on this device. */
    public function show(Request $request): JsonResponse
    {
        $key = $request->user()->passwordKey;

        if (! $key) {
            return self::apiErrorResponse('No key stored for this account.', code: 404);
        }

        return self::apiSuccessResponse('Locked data key', ['key' => $key->toArray()]);
    }

    /**
     * New recovery key (e.g. the old one was lost or exposed).
     * Requires the current password's auth key.
     */
    public function replaceRecovery(Request $request, ReplacePassword $replacePassword): JsonResponse
    {
        $data = $request->validate([
            'password' => 'required|string|max:255',
            ...UserKey::envelopeRules('keys.recovery', withKdf: true, withAuth: true),
        ]);

        $user = $request->user();

        if (! Hash::check($data['password'], $user->password)) {
            return self::apiSingleErrorResponse('password', 'The password is incorrect.');
        }

        $key = $replacePassword->replaceKey($user, UserKeyType::Recovery, [
            'wrapped_key' => $data['keys']['recovery']['wrapped_key'],
            'kdf' => $data['keys']['recovery']['kdf'],
            'auth_hash' => $data['keys']['recovery']['auth'],
        ]);

        return self::apiSuccessResponse('Recovery key replaced', ['version' => $key->version]);
    }
}
