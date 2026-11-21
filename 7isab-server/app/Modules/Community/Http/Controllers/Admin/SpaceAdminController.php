<?php

namespace App\Modules\Community\Http\Controllers\Admin;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use App\Modules\Community\Models\SpaceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Admin review of group and page requests, and the spaces themselves
 * (close, reopen, transfer). Only admins create spaces, from a request.
 */
class SpaceAdminController extends Controller
{
    public function requests(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,approved,rejected,changes_requested',
            'page' => 'nullable|integer|min:1',
        ]);

        $page = SpaceRequest::query()
            ->where('status', $validated['status'] ?? 'pending')
            ->with('requester:id,first_name,last_name,gender')
            ->oldest()
            ->paginate(20, page: $validated['page'] ?? 1);

        return self::apiSuccessResponse('Requests', [
            'items' => $page->items(),
            'itemsCount' => $page->total(),
            'pagesCount' => $page->lastPage(),
            'page' => $page->currentPage(),
        ]);
    }

    /**
     * Creates the space: a group takes the requester's gender; a page is for
     * everyone or the requester's gender. The requester becomes the owner.
     */
    public function approve(Request $request, SpaceRequest $spaceRequest): JsonResponse
    {
        if ($spaceRequest->status !== 'pending') {
            return self::apiErrorResponse('Only a pending request can be approved', code: 409);
        }

        $owner = $spaceRequest->requester;

        $space = DB::transaction(function () use ($request, $spaceRequest, $owner) {
            $space = Space::create([
                'type' => $spaceRequest->type,
                'name' => $spaceRequest->name,
                'slug' => $this->slug($spaceRequest),
                'purpose' => $spaceRequest->purpose,
                'goals' => $spaceRequest->goals,
                'content_plan' => $spaceRequest->content_plan,
                'owner_id' => $owner->id,
                'gender' => $spaceRequest->type === 'group' || $spaceRequest->audience === 'gender' ? $owner->gender : null,
                'join_policy' => $spaceRequest->join_policy ?? 'open',
                'posting_public' => true,
                'posting_gender' => 'any',
                'posting_requires_approval' => false,
                'status' => 'active',
            ]);

            SpaceMember::create(['space_id' => $space->id, 'profile_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);

            $spaceRequest->update(['status' => 'approved', 'admin_note' => null, 'reviewed_by' => $request->user()->id]);

            return $space;
        });

        return self::apiSuccessResponse('Space created', ['item' => $space], 201);
    }

    public function reject(Request $request, SpaceRequest $spaceRequest): JsonResponse
    {
        return $this->decide($request, $spaceRequest, 'rejected', 'Request rejected');
    }

    public function requestChanges(Request $request, SpaceRequest $spaceRequest): JsonResponse
    {
        return $this->decide($request, $spaceRequest, 'changes_requested', 'Changes requested');
    }

    public function spaces(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'nullable|in:group,page',
            'status' => 'nullable|in:active,closed',
            'search' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $page = Space::query()
            ->when($validated['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($validated['search'] ?? null, fn ($q, $search) => $q->where('name', 'ilike', "%{$search}%"))
            ->with('owner:id,first_name,last_name,gender')
            ->withCount(['members as members_count' => fn ($m) => $m->where('status', 'active')])
            ->latest()
            ->paginate(20, page: $validated['page'] ?? 1);

        return self::apiSuccessResponse('Spaces', [
            'items' => $page->items(),
            'itemsCount' => $page->total(),
            'pagesCount' => $page->lastPage(),
            'page' => $page->currentPage(),
        ]);
    }

    public function close(Space $space): JsonResponse
    {
        $space->update(['status' => 'closed']);

        return self::apiSuccessResponse('Space closed', ['item' => $space]);
    }

    public function reopen(Space $space): JsonResponse
    {
        $space->update(['status' => 'active']);

        return self::apiSuccessResponse('Space reopened', ['item' => $space]);
    }

    /** Gives the space to another active member of the same gender; the old owner stays as a moderator. */
    public function transfer(Request $request, Space $space): JsonResponse
    {
        $validated = $request->validate(['profile_id' => 'required|integer|exists:community_profiles,id']);
        $newOwner = CommunityProfile::findOrFail($validated['profile_id']);
        $oldOwner = $space->owner;

        if ($newOwner->id === $space->owner_id) {
            return self::apiErrorResponse('Already the owner', code: 409);
        }

        if ($newOwner->status !== 'active' || $newOwner->gender !== $oldOwner->gender) {
            return self::apiSingleErrorResponse('profile_id', 'The new owner must be an active member of the owner\'s gender.');
        }

        DB::transaction(function () use ($space, $newOwner, $oldOwner) {
            SpaceMember::updateOrCreate(
                ['space_id' => $space->id, 'profile_id' => $newOwner->id],
                ['role' => 'owner', 'status' => 'active'],
            );
            SpaceMember::where('space_id', $space->id)->where('profile_id', $oldOwner->id)->update(['role' => 'moderator']);
            $space->update(['owner_id' => $newOwner->id]);
        });

        return self::apiSuccessResponse('Space transferred', ['item' => $space->fresh('owner:id,first_name,last_name,gender')]);
    }

    private function decide(Request $request, SpaceRequest $spaceRequest, string $status, string $message): JsonResponse
    {
        if ($spaceRequest->status !== 'pending') {
            return self::apiErrorResponse('Only a pending request can be reviewed', code: 409);
        }

        $validated = $request->validate(['note' => 'required|string|max:1000']);
        $spaceRequest->update(['status' => $status, 'admin_note' => $validated['note'], 'reviewed_by' => $request->user()->id]);

        return self::apiSuccessResponse($message, ['item' => $spaceRequest]);
    }

    /** Names can be in Arabic (no Latin slug): a short random part keeps every slug unique. */
    private function slug(SpaceRequest $spaceRequest): string
    {
        $base = Str::slug($spaceRequest->name) ?: $spaceRequest->type;

        return Str::limit($base, 60, '').'-'.Str::lower(Str::random(6));
    }
}
