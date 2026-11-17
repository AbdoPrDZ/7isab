<?php

namespace App\Modules\Admin\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * App-user management for admins.
 *
 * Admins see account metadata only (email, dates, storage, devices).
 * User data is encrypted on the device and can't be read here.
 * Admin accounts are not reachable through these routes.
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return User::tablingCollect(
            $request,
            query: User::query()->whereDoesntHave('roles'),
            map: fn (User $user) => [...$user->toArray(), 'devices_count' => $user->tokens()->count()],
        );
    }

    public function show(User $user): JsonResponse
    {
        $this->ensureAppUser($user);

        return self::apiSuccessResponse('User', ['item' => $this->details($user)]);
    }

    /** Disables the account and signs it out everywhere. */
    public function disable(User $user): JsonResponse
    {
        $this->ensureAppUser($user);

        $user->forceFill(['is_active' => false])->save();
        $user->tokens()->delete();

        return self::apiSuccessResponse('User disabled', ['item' => $this->details($user)]);
    }

    public function enable(User $user): JsonResponse
    {
        $this->ensureAppUser($user);

        $user->forceFill(['is_active' => true])->save();

        return self::apiSuccessResponse('User enabled', ['item' => $this->details($user)]);
    }

    /** Signs the user out on every device. */
    public function signOut(User $user): JsonResponse
    {
        $this->ensureAppUser($user);

        $user->tokens()->delete();

        return self::apiSuccessResponse('User signed out on all devices');
    }

    /**
     * Permanently deletes the account and all of its encrypted data and keys.
     */
    public function destroy(User $user): JsonResponse
    {
        $this->ensureAppUser($user);

        $user->tokens()->delete();
        $user->forceDelete();

        return self::apiSuccessResponse('User deleted');
    }

    private function ensureAppUser(User $user): void
    {
        abort_if($user->isAdmin(), 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function details(User $user): array
    {
        return [
            ...$user->fresh()->toArray(),
            'devices_count' => $user->tokens()->count(),
            'records_count' => $user->syncRecords()->count(),
        ];
    }
}
