<?php

namespace App\Modules\Admin\Http\Controllers;

use App\Core\Enums\ValidationType;
use App\Core\Http\Controller;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin-account management. Super admins only.
 *
 * A super admin can't change their own role, disable or delete themselves,
 * so the panel can never be left without a super admin by accident.
 */
class AdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return User::tablingCollect(
            $request,
            query: User::query()->whereHas('roles'),
            load: ['roles'],
            map: fn (User $user) => $this->payload($user),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            ...User::validationRules(ValidationType::Create),
            'role' => ['required', Rule::in(Role::values())],
        ]);

        $admin = DB::transaction(function () use ($data): User {
            $admin = User::create([
                'name' => $data['name'] ?? null,
                'email' => $data['email'],
                'password' => $data['password'],
                'kdf' => null,
                'is_active' => true,
            ]);
            $admin->assignRole($data['role']);

            return $admin;
        });

        return self::apiSuccessResponse('Admin created', ['item' => $this->payload($admin)], 201);
    }

    public function show(User $admin): JsonResponse
    {
        $this->ensureAdmin($admin);

        return self::apiSuccessResponse('Admin', ['item' => $this->payload($admin)]);
    }

    public function update(Request $request, User $admin): JsonResponse
    {
        $this->ensureAdmin($admin);

        $data = $request->validate([
            ...User::validationRules(ValidationType::Update, $admin),
            'password' => 'sometimes|string|min:8|max:255',
            'role' => ['sometimes', Rule::in(Role::values())],
        ]);

        $isSelf = $admin->is($request->user());

        if ($isSelf && (isset($data['role']) && $data['role'] !== $admin->getRoleNames()->first())) {
            return self::apiSingleErrorResponse('role', 'You can\'t change your own role.', code: 403);
        }

        if ($isSelf && array_key_exists('is_active', $data) && ! $data['is_active']) {
            return self::apiSingleErrorResponse('is_active', 'You can\'t disable your own account.', code: 403);
        }

        DB::transaction(function () use ($admin, $data): void {
            $admin->fill(collect($data)->only(['name', 'email', 'is_active'])->all());

            if (isset($data['password'])) {
                $admin->password = $data['password'];
            }

            $admin->save();

            if (isset($data['role'])) {
                $admin->syncRoles([$data['role']]);
            }

            if ($admin->wasChanged('password') || ($admin->wasChanged('is_active') && ! $admin->is_active)) {
                $admin->tokens()->delete();
            }
        });

        return self::apiSuccessResponse('Admin updated', ['item' => $this->payload($admin->fresh())]);
    }

    public function destroy(Request $request, User $admin): JsonResponse
    {
        $this->ensureAdmin($admin);

        if ($admin->is($request->user())) {
            return self::apiErrorResponse('You can\'t delete your own account.', code: 403);
        }

        $admin->tokens()->delete();
        $admin->forceDelete();

        return self::apiSuccessResponse('Admin deleted');
    }

    private function ensureAdmin(User $user): void
    {
        abort_unless($user->isAdmin(), 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        return [...$user->toArray(), 'role' => $user->getRoleNames()->first()];
    }
}
