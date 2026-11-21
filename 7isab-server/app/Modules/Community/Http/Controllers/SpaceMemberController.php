<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Moderation by a space's owner and moderators: join requests, removing
 * members, and (owner only) appointing moderators of the owner's gender.
 */
class SpaceMemberController extends Controller
{
    public function index(Request $request, int $id): JsonResponse
    {
        [$space] = $this->managed($request, $id);

        $validated = $request->validate(['status' => 'nullable|in:active,pending,banned']);

        $members = $space->members()
            ->where('status', $validated['status'] ?? 'active')
            ->with('profile:id,first_name,last_name,gender')
            ->orderByRaw("case role when 'owner' then 0 when 'moderator' then 1 else 2 end")
            ->orderBy('id')
            ->limit(200)
            ->get()
            ->map(fn (SpaceMember $member) => $this->memberData($member));

        return self::apiSuccessResponse('Members', ['members' => $members]);
    }

    public function approve(Request $request, int $id, int $memberId): JsonResponse
    {
        [$space] = $this->managed($request, $id);
        $member = $space->members()->where('status', 'pending')->findOrFail($memberId);

        $member->update(['status' => 'active']);

        return self::apiSuccessResponse('Member approved', ['member' => $this->memberData($member)]);
    }

    public function reject(Request $request, int $id, int $memberId): JsonResponse
    {
        [$space] = $this->managed($request, $id);
        $space->members()->where('status', 'pending')->findOrFail($memberId)->delete();

        return self::apiSuccessResponse('Request declined');
    }

    /** Removes a member or follower and keeps them out. Moderators can't remove the owner or each other. */
    public function ban(Request $request, int $id, int $memberId): JsonResponse
    {
        [$space, $profile] = $this->managed($request, $id);
        $member = $space->members()->findOrFail($memberId);

        if ($member->role === 'owner' || ($member->role === 'moderator' && $space->owner_id !== $profile->id)) {
            return self::apiErrorResponse('Not allowed to remove this member', code: 403);
        }

        $member->update(['status' => 'banned', 'role' => $member->role === 'moderator' ? 'member' : $member->role]);

        return self::apiSuccessResponse('Member removed', ['member' => $this->memberData($member)]);
    }

    /** Lets a removed person join or follow again. */
    public function unban(Request $request, int $id, int $memberId): JsonResponse
    {
        [$space] = $this->managed($request, $id);
        $space->members()->where('status', 'banned')->findOrFail($memberId)->delete();

        return self::apiSuccessResponse('Member can return');
    }

    /** Owner only: a moderator must be an active member of the owner's gender. */
    public function setRole(Request $request, int $id, int $memberId): JsonResponse
    {
        [$space, $profile] = $this->managed($request, $id);

        if ($space->owner_id !== $profile->id) {
            return self::apiErrorResponse('Only the owner appoints moderators', code: 403);
        }

        $validated = $request->validate(['role' => 'required|in:moderator,member']);
        $member = $space->members()->where('status', 'active')->with('profile')->findOrFail($memberId);

        if ($member->role === 'owner') {
            return self::apiErrorResponse('The owner keeps their role', code: 409);
        }

        if ($validated['role'] === 'moderator' && $member->profile->gender !== $profile->gender) {
            return self::apiSingleErrorResponse('role', 'Moderators are of the owner\'s gender.');
        }

        // On a page, a moderator who steps down goes back to following it.
        $role = $validated['role'] === 'member' && $space->type === 'page' ? 'follower' : $validated['role'];
        $member->update(['role' => $role]);

        return self::apiSuccessResponse('Role changed', ['member' => $this->memberData($member)]);
    }

    /** @return array{0: Space, 1: CommunityProfile} */
    private function managed(Request $request, int $id): array
    {
        $profile = $request->user()->communityProfile;
        $space = Space::visibleTo($profile)->findOrFail($id);

        abort_unless($space->isManagedBy($profile), 403, 'Only the owner and moderators manage members');

        return [$space, $profile];
    }

    /** @return array<string, mixed> */
    private function memberData(SpaceMember $member): array
    {
        $member->loadMissing('profile:id,first_name,last_name,gender');

        return [
            'id' => $member->id,
            'role' => $member->role,
            'status' => $member->status,
            'joined_at' => $member->created_at,
            'profile' => $member->profile?->only(['id', 'first_name', 'last_name', 'gender']),
        ];
    }
}
