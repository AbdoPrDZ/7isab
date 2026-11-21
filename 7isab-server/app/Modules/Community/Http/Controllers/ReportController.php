<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Block;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\FatwaPublication;
use App\Modules\Community\Models\FatwaQuestion;
use App\Modules\Community\Models\Mute;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\Report;
use App\Modules\Community\Models\Space;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Safety for members: reporting what they can see, and blocking or muting
 * other members (both hide that member's posts and comments).
 */
class ReportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $validated = $request->validate([
            'target_type' => ['required', Rule::in(Report::TARGETS)],
            'target_id' => 'required|integer',
            'reason' => ['required', Rule::in(Report::REASONS)],
            'details' => 'nullable|string|max:2000',
        ]);

        if (! $this->canSee($profile, $validated['target_type'], (int) $validated['target_id'])) {
            return self::apiErrorResponse('Not found', code: 404);
        }

        $report = Report::firstOrCreate(
            [
                'reporter_id' => $profile->id,
                'target_type' => $validated['target_type'],
                'target_id' => $validated['target_id'],
                'status' => 'pending',
            ],
            ['reason' => $validated['reason'], 'details' => $validated['details'] ?? null],
        );

        return self::apiSuccessResponse('Report sent', ['report' => $report->only(['id', 'status'])], 201);
    }

    public function blocks(Request $request): JsonResponse
    {
        return $this->list(Block::class, $this->profile($request));
    }

    public function block(Request $request): JsonResponse
    {
        return $this->add(Block::class, $request, 'Blocked');
    }

    public function unblock(Request $request, int $id): JsonResponse
    {
        Block::where('profile_id', $this->profile($request)->id)->where('target_id', $id)->delete();

        return self::apiSuccessResponse('Unblocked');
    }

    public function mutes(Request $request): JsonResponse
    {
        return $this->list(Mute::class, $this->profile($request));
    }

    public function mute(Request $request): JsonResponse
    {
        return $this->add(Mute::class, $request, 'Muted');
    }

    public function unmute(Request $request, int $id): JsonResponse
    {
        Mute::where('profile_id', $this->profile($request)->id)->where('target_id', $id)->delete();

        return self::apiSuccessResponse('Unmuted');
    }

    /** @param  class-string<Block|Mute>  $model */
    private function add(string $model, Request $request, string $message): JsonResponse
    {
        $profile = $this->profile($request);
        $validated = $request->validate(['target_id' => 'required|integer|exists:community_profiles,id']);

        if ((int) $validated['target_id'] === $profile->id) {
            return self::apiSingleErrorResponse('target_id', 'You cannot do this to yourself.');
        }

        $model::firstOrCreate(['profile_id' => $profile->id, 'target_id' => $validated['target_id']]);

        return self::apiSuccessResponse($message, [], 201);
    }

    /** @param  class-string<Block|Mute>  $model */
    private function list(string $model, CommunityProfile $profile): JsonResponse
    {
        $items = $model::where('profile_id', $profile->id)
            ->with('target:id,first_name,last_name')
            ->latest('created_at')
            ->get()
            ->map(fn (Block|Mute $item) => $item->target?->only(['id', 'first_name', 'last_name']))
            ->filter()
            ->values();

        return self::apiSuccessResponse('List', ['items' => $items]);
    }

    /** A member reports only what they can see: their gender's comments, visible posts and spaces. */
    private function canSee(CommunityProfile $profile, string $type, int $id): bool
    {
        return match ($type) {
            'post' => Post::visibleTo($profile)->whereKey($id)->exists(),
            'comment' => Comment::whereKey($id)
                ->where('author_gender', $profile->gender)
                ->whereHas('post', fn ($post) => $post->whereIn('id', Post::visibleTo($profile)->select('id')))
                ->exists(),
            'space' => Space::visibleTo($profile)->whereKey($id)->exists(),
            'profile' => CommunityProfile::whereKey($id)->where('id', '!=', $profile->id)->exists(),
            'fatwa' => FatwaPublication::publishedFor($profile)->whereKey($id)->exists(),
            // Only a shaykh the question reached reports it.
            'fatwa_question' => (bool) $profile->shaykh?->isTrusted() && FatwaQuestion::whereKey($id)
                ->where(fn ($q) => $q
                    ->whereHas('threads', fn ($thread) => $thread->where('shaykh_id', $profile->shaykh->id))
                    ->orWhere(fn ($open) => $open->whereNull('target_shaykh_id')->where('shaykh_gender', $profile->gender)))
                ->exists(),
        };
    }

    private function profile(Request $request): CommunityProfile
    {
        return $request->user()->communityProfile;
    }
}
