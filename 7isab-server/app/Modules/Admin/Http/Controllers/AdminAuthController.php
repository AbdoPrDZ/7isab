<?php

namespace App\Modules\Admin\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\User;
use App\Modules\Auth\Actions\IssueAccessToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Admin panel sign-in. Only accounts with an admin role can sign in here,
 * and their tokens only work on admin routes.
 */
class AdminAuthController extends Controller
{
    private const DUMMY_HASH = '$2y$12$Kq7N2k1m3eQe3n0yq0b3wO2sK1pQf0nB7oM8tR5uV4wX3yZ2aB1cC';

    public function login(Request $request, IssueAccessToken $issueToken): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email:rfc|max:255',
            'password' => 'required|string|max:255',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! $user->isAdmin()) {
            Hash::check($data['password'], self::DUMMY_HASH);

            return self::apiErrorResponse('Invalid email or password.', code: 401);
        }

        if (! Hash::check($data['password'], $user->password)) {
            return self::apiErrorResponse('Invalid email or password.', code: 401);
        }

        if (! $user->is_active) {
            return self::apiErrorResponse('This account is disabled.', code: 403);
        }

        $token = $issueToken->handle($user, IssueAccessToken::ADMIN, 'admin-panel');

        return self::apiSuccessResponse('Signed in', [
            'token' => $token,
            'user' => $this->payload($user->fresh()),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return self::apiSuccessResponse('Current admin', ['user' => $this->payload($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return self::apiSuccessResponse('Signed out');
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        return [...$user->toArray(), 'role' => $user->getRoleNames()->first()];
    }
}
