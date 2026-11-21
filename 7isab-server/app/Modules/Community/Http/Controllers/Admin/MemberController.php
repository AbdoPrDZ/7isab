<?php

namespace App\Modules\Community\Http\Controllers\Admin;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin view of community members: suspend, ban, reactivate, and change gender
 * (the only way gender ever changes).
 */
class MemberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $exact = $request->validate([
            'gender' => 'nullable|in:male,female',
            'status' => 'nullable|in:active,suspended,left,banned',
        ]);

        $query = CommunityProfile::query()
            ->with('user:id,email')
            ->when($exact['gender'] ?? null, fn ($q, $gender) => $q->where('gender', $gender))
            ->when($exact['status'] ?? null, fn ($q, $status) => $q->where('status', $status));

        return CommunityProfile::tablingCollect(
            $request,
            query: $query,
            map: fn (CommunityProfile $profile) => $this->details($profile),
        );
    }

    public function suspend(CommunityProfile $member): JsonResponse
    {
        return $this->setStatus($member, 'suspended', 'Member suspended');
    }

    /** A banned member can't rejoin; only an admin can reactivate them. */
    public function ban(CommunityProfile $member): JsonResponse
    {
        return $this->setStatus($member, 'banned', 'Member banned');
    }

    public function reactivate(CommunityProfile $member): JsonResponse
    {
        if (! in_array($member->status, ['suspended', 'banned'], true)) {
            return self::apiErrorResponse('Only a suspended or banned member can be reactivated', code: 409);
        }

        return $this->setStatus($member, 'active', 'Member reactivated');
    }

    public function changeGender(Request $request, CommunityProfile $member): JsonResponse
    {
        $validated = $request->validate(['gender' => 'required|in:male,female']);

        $member->update(['gender' => $validated['gender']]);

        return self::apiSuccessResponse('Gender changed', ['item' => $this->details($member)]);
    }

    private function setStatus(CommunityProfile $member, string $status, string $message): JsonResponse
    {
        $member->update(['status' => $status]);

        return self::apiSuccessResponse($message, ['item' => $this->details($member)]);
    }

    /** @return array<string, mixed> */
    private function details(CommunityProfile $profile): array
    {
        return [
            'id' => $profile->id,
            'user_id' => $profile->user_id,
            'email' => $profile->user?->email,
            'first_name' => $profile->first_name,
            'last_name' => $profile->last_name,
            'gender' => $profile->gender,
            'status' => $profile->status,
            'joined_at' => $profile->joined_at,
            'created_at' => $profile->created_at,
        ];
    }
}
