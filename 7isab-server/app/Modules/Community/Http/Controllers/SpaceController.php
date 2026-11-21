<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use App\Modules\Community\Models\SpaceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Groups and pages for members: discovery, details, joining and following,
 * the owner's settings, and creation requests. A space the viewer may not see
 * (the other gender's) answers 404, as if it didn't exist.
 */
class SpaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $validated = $request->validate([
            'type' => 'nullable|in:group,page',
            'scope' => 'nullable|in:mine,discover',
            'search' => 'nullable|string|max:100',
        ]);

        $page = Space::visibleTo($profile)
            ->when($validated['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->when(($validated['scope'] ?? null) === 'mine', fn ($q) => $q->whereHas('members', fn ($m) => $m
                ->where('profile_id', $profile->id)
                ->whereIn('status', ['active', 'pending'])))
            ->when($validated['search'] ?? null, function ($q, $search) {
                $like = $q->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
                $q->where(fn ($text) => $text->where('name', $like, "%{$search}%")->orWhere('purpose', $like, "%{$search}%"));
            })
            ->withCount(['members as members_count' => fn ($m) => $m->where('status', 'active')])
            ->with(['members' => fn ($m) => $m->where('profile_id', $profile->id)])
            ->orderBy('name')
            ->simplePaginate(30);

        return self::apiSuccessResponse('Spaces', [
            'spaces' => collect($page->items())->map(fn (Space $space) => $this->summary($space, $space->members->first())),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $profile = $this->profile($request);
        $space = Space::visibleTo($profile)->where('slug', $slug)->with('owner:id,first_name,last_name')->firstOrFail();
        $membership = $space->membershipOf($profile);

        return self::apiSuccessResponse('Space', ['space' => [
            ...$this->summary($space, $membership),
            'goals' => $space->goals,
            'content_plan' => $space->content_plan,
            'owner' => ['id' => $space->owner->id, 'first_name' => $space->owner->first_name, 'last_name' => $space->owner->last_name],
            'posting_public' => $space->posting_public,
            'posting_gender' => $space->posting_gender ?? 'any',
            'posting_requires_approval' => $space->posting_requires_approval,
            'members_count' => $space->members()->where('status', 'active')->count(),
            'can_post' => $space->allowsPostingBy($profile),
            'can_manage' => $space->isManagedBy($profile),
        ]]);
    }

    /** Groups only: open groups admit at once, the others wait for the owner or a moderator. */
    public function join(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = $this->visibleSpace($id, $profile);

        if ($space->type !== 'group') {
            return self::apiErrorResponse('Pages are followed, not joined', code: 422);
        }

        if ($error = $this->existingMembershipError($space->membershipOf($profile))) {
            return $error;
        }

        $membership = SpaceMember::create([
            'space_id' => $space->id,
            'profile_id' => $profile->id,
            'role' => 'member',
            'status' => $space->join_policy === 'open' ? 'active' : 'pending',
        ]);

        return self::apiSuccessResponse(
            $membership->status === 'active' ? 'Joined' : 'Join request sent',
            ['space' => $this->summary($space, $membership)],
            201,
        );
    }

    /** Leaves a group (or withdraws a pending request). The owner can't leave. */
    public function leave(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = $this->visibleSpace($id, $profile);
        $membership = $space->membershipOf($profile);

        if (! $membership || $membership->status === 'banned' || $membership->role === 'follower') {
            return self::apiErrorResponse('Not a member of this group', code: 404);
        }

        if ($membership->role === 'owner') {
            return self::apiErrorResponse('The owner cannot leave their space', ['reason' => 'owner'], 403);
        }

        $membership->delete();

        return self::apiSuccessResponse('Left', ['space' => $this->summary($space, null)]);
    }

    public function follow(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = $this->visibleSpace($id, $profile);

        if ($space->type !== 'page') {
            return self::apiErrorResponse('Groups are joined, not followed', code: 422);
        }

        if ($error = $this->existingMembershipError($space->membershipOf($profile))) {
            return $error;
        }

        $membership = SpaceMember::create([
            'space_id' => $space->id,
            'profile_id' => $profile->id,
            'role' => 'follower',
            'status' => 'active',
        ]);

        return self::apiSuccessResponse('Following', ['space' => $this->summary($space, $membership)], 201);
    }

    public function unfollow(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = $this->visibleSpace($id, $profile);
        $membership = $space->membershipOf($profile);

        if (! $membership || $membership->role !== 'follower' || $membership->status !== 'active') {
            return self::apiErrorResponse('Not following this page', code: 404);
        }

        $membership->delete();

        return self::apiSuccessResponse('Unfollowed', ['space' => $this->summary($space, null)]);
    }

    /** The owner's settings: joining for a group; posting for a page. */
    public function updateSettings(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = $this->visibleSpace($id, $profile);

        if ($space->owner_id !== $profile->id) {
            return self::apiErrorResponse('Only the owner can change the settings', code: 403);
        }

        if ($space->type === 'group') {
            $validated = $request->validate(['join_policy' => 'required|in:open,approval']);
        } else {
            // A page for one gender can't be limited to the other.
            $genders = $space->gender ? ['any', $space->gender] : ['any', 'male', 'female'];
            $validated = $request->validate([
                'posting_public' => 'required|boolean',
                'posting_gender' => ['required', Rule::in($genders)],
                'posting_requires_approval' => 'required|boolean',
            ]);
        }

        $space->update($validated);

        return $this->show($request, $space->slug);
    }

    public function requestCreation(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $spaceRequest = SpaceRequest::create([
            ...$this->validatedRequest($request),
            'requester_id' => $profile->id,
            'status' => 'pending',
        ]);

        return self::apiSuccessResponse('Request sent', ['request' => $this->requestData($spaceRequest)], 201);
    }

    /** Resubmits a request the admins sent back for changes. */
    public function updateRequest(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $spaceRequest = SpaceRequest::where('requester_id', $profile->id)->findOrFail($id);

        if ($spaceRequest->status !== 'changes_requested') {
            return self::apiErrorResponse('Only a request sent back for changes can be edited', code: 409);
        }

        $spaceRequest->update([...$this->validatedRequest($request), 'status' => 'pending']);

        return self::apiSuccessResponse('Request sent again', ['request' => $this->requestData($spaceRequest)]);
    }

    public function myRequests(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        return self::apiSuccessResponse('Requests', [
            'requests' => SpaceRequest::where('requester_id', $profile->id)
                ->latest()
                ->get()
                ->map(fn (SpaceRequest $spaceRequest) => $this->requestData($spaceRequest)),
        ]);
    }

    /** @return array<string, mixed> */
    private function validatedRequest(Request $request): array
    {
        $validated = $request->validate([
            'type' => 'required|in:group,page',
            'name' => 'required|string|max:120',
            'purpose' => 'required|string|max:1000',
            'goals' => 'required|string|max:1000',
            'content_plan' => 'required|string|max:2000',
            'join_policy' => 'required_if:type,group|nullable|in:open,approval',
            'audience' => 'required_if:type,page|nullable|in:everyone,gender',
        ]);

        // Each type keeps only its own option.
        return [
            ...$validated,
            'join_policy' => $validated['type'] === 'group' ? $validated['join_policy'] : null,
            'audience' => $validated['type'] === 'page' ? $validated['audience'] : null,
        ];
    }

    private function existingMembershipError(?SpaceMember $membership): ?JsonResponse
    {
        if (! $membership) {
            return null;
        }

        if ($membership->status === 'banned') {
            return self::apiErrorResponse('You were removed from this space', ['reason' => 'banned'], 403);
        }

        return self::apiErrorResponse('Already in this space', ['reason' => 'already'], 409);
    }

    private function profile(Request $request): CommunityProfile
    {
        return $request->user()->communityProfile;
    }

    private function visibleSpace(int $id, CommunityProfile $profile): Space
    {
        return Space::visibleTo($profile)->findOrFail($id);
    }

    /** @return array<string, mixed> */
    private function summary(Space $space, ?SpaceMember $membership): array
    {
        return [
            'id' => $space->id,
            'type' => $space->type,
            'name' => $space->name,
            'slug' => $space->slug,
            'purpose' => $space->purpose,
            'audience' => $space->type === 'page' ? ($space->gender ? 'gender' : 'everyone') : 'gender',
            'join_policy' => $space->type === 'group' ? $space->join_policy : null,
            'members_count' => $space->members_count ?? null,
            'my_role' => $membership?->role,
            'my_status' => $membership?->status,
        ];
    }

    /** @return array<string, mixed> */
    private function requestData(SpaceRequest $spaceRequest): array
    {
        return $spaceRequest->only(['id', 'type', 'name', 'purpose', 'goals', 'content_plan', 'join_policy', 'audience', 'status', 'admin_note', 'created_at', 'updated_at']);
    }
}
