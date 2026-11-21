<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use App\Modules\Community\Models\SpaceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SpaceController extends Controller
{
    public function discover(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        $query = Space::where('status', 'active')
            ->where(function ($q) use ($profile) {
                $q->whereNull('gender')
                    ->orWhere('gender', $profile->gender);
            });

        if ($request->has('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->has('search')) {
            $search = '%'.$request->input('search').'%';
            $query->where('name', 'like', $search)
                ->orWhere('purpose', 'like', $search);
        }

        $spaces = $query->with('owner', 'members')
            ->paginate(20);

        return response()->json(['spaces' => $spaces]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $space = Space::where('slug', $slug)
            ->with('owner', 'members.profile')
            ->firstOrFail();

        $user = $request->user();
        $membership = $space->members()
            ->where('profile_id', $user->communityProfile->id)
            ->first();

        return response()->json([
            'space' => [
                'id' => $space->id,
                'type' => $space->type,
                'name' => $space->name,
                'slug' => $space->slug,
                'purpose' => $space->purpose,
                'goals' => $space->goals,
                'owner' => [
                    'id' => $space->owner->id,
                    'name' => $space->owner->first_name.' '.$space->owner->last_name,
                ],
                'member_count' => $space->members()->where('status', 'active')->count(),
                'my_role' => $membership?->role,
                'my_status' => $membership?->status,
            ],
        ]);
    }

    public function join(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if ($space->gender && $space->gender !== $profile->gender) {
            return Controller::apiErrorResponse('Cannot join space for different gender', code: 403);
        }

        if ($space->members()->where('profile_id', $profile->id)->exists()) {
            return Controller::apiErrorResponse('Already member of this space', code: 409);
        }

        $status = $space->join_policy === 'open' ? 'active' : 'pending';

        SpaceMember::create([
            'space_id' => $space->id,
            'profile_id' => $profile->id,
            'role' => $status === 'active' ? 'member' : 'member',
            'status' => $status,
        ]);

        return response()->json(['message' => 'Join request submitted', 'status' => $status], 201);
    }

    public function leave(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        $membership = $space->members()
            ->where('profile_id', $profile->id)
            ->firstOrFail();

        if ($membership->role === 'owner') {
            return Controller::apiErrorResponse('Owner cannot leave their space', code: 403);
        }

        $membership->delete();

        return response()->json(['message' => 'Left space']);
    }

    public function follow(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if ($space->type !== 'page') {
            return Controller::apiErrorResponse('Can only follow pages', code: 400);
        }

        if ($space->members()->where('profile_id', $profile->id)->exists()) {
            return Controller::apiErrorResponse('Already following or member', code: 409);
        }

        SpaceMember::create([
            'space_id' => $space->id,
            'profile_id' => $profile->id,
            'role' => 'follower',
            'status' => 'active',
        ]);

        return response()->json(['message' => 'Following page'], 201);
    }

    public function unfollow(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        $membership = $space->members()
            ->where('profile_id', $profile->id)
            ->where('role', 'follower')
            ->firstOrFail();

        $membership->delete();

        return response()->json(['message' => 'Unfollowed page']);
    }

    public function requestCreation(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        $validated = $request->validate([
            'type' => 'required|in:group,page',
            'name' => 'required|string|max:200',
            'purpose' => 'required|string|max:1000',
            'goals' => 'required|string|max:1000',
            'content_plan' => 'required|string|max:2000',
            'join_policy' => 'sometimes|in:open,approval',
            'audience' => 'sometimes|in:everyone,gender',
        ]);

        SpaceRequest::create([
            'requester_id' => $profile->id,
            'type' => $validated['type'],
            'name' => $validated['name'],
            'purpose' => $validated['purpose'],
            'goals' => $validated['goals'],
            'content_plan' => $validated['content_plan'],
            'join_policy' => $validated['join_policy'] ?? 'open',
            'audience' => $validated['audience'] ?? 'everyone',
            'status' => 'pending',
        ]);

        return response()->json(['message' => 'Space creation request submitted'], 201);
    }

    public function myRequests(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        $requests = SpaceRequest::where('requester_id', $profile->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'type' => $r->type,
                'name' => $r->name,
                'status' => $r->status,
                'created_at' => $r->created_at,
                'admin_note' => $r->admin_note,
            ]);

        return response()->json(['requests' => $requests]);
    }
}
