<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\FatwaPublication;
use App\Modules\Community\Models\Shaykh;
use App\Modules\Community\Models\ShaykhRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Trusted shaykhs for members: trust requests, shaykh profiles (manhaj and
 * marja' are public), and published fatwas. Female shaykhs and their fatwas
 * are for women only.
 */
class ShaykhController extends Controller
{
    public function requestTrust(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        if ($profile->shaykh?->isTrusted()) {
            return self::apiErrorResponse('Already a trusted shaykh', code: 409);
        }

        $existing = ShaykhRequest::where('profile_id', $profile->id)->first();
        if ($existing?->status === 'pending') {
            return self::apiErrorResponse('A request is already under review', code: 409);
        }

        $validated = $request->validate([
            'manhaj' => 'required|string|max:2000',
            'marja' => 'required|string|max:2000',
            'studies' => 'nullable|string|max:3000',
            'ijazat' => 'nullable|string|max:3000',
            'teachers' => 'nullable|string|max:3000',
            'institution' => 'nullable|string|max:500',
            'teaching' => 'nullable|string|max:1000',
        ]);

        // One request per member: a rejected one is sent again with the new details.
        $trustRequest = ShaykhRequest::updateOrCreate(
            ['profile_id' => $profile->id],
            [...array_fill_keys(ShaykhRequest::FIELDS, null), ...$validated, 'status' => 'pending', 'admin_note' => null],
        );

        return self::apiSuccessResponse('Request sent', ['request' => $this->requestData($trustRequest)], 201);
    }

    public function myRequest(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $trustRequest = ShaykhRequest::where('profile_id', $profile->id)->first();

        return self::apiSuccessResponse('Request', [
            'request' => $trustRequest ? $this->requestData($trustRequest) : null,
            'is_shaykh' => (bool) $profile->shaykh?->isTrusted(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $shaykhs = Shaykh::visibleTo($profile)
            ->with('profile:id,first_name,last_name,gender,status')
            ->withCount(['threads as fatwas_count' => fn ($thread) => $thread->whereHas('publication', fn ($p) => $p->whereNotNull('published_at'))])
            ->get()
            ->sortBy(fn (Shaykh $shaykh) => $shaykh->profile->first_name)
            ->map(fn (Shaykh $shaykh) => [...$shaykh->publicData(), 'fatwas_count' => $shaykh->fatwas_count])
            ->values();

        return self::apiSuccessResponse('Shaykhs', ['shaykhs' => $shaykhs]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $shaykh = Shaykh::visibleTo($profile)->with('profile')->findOrFail($id);

        return self::apiSuccessResponse('Shaykh', [
            'shaykh' => $shaykh->publicData(),
            'fatwas' => $this->publishedFatwas($profile, $shaykh->id),
        ]);
    }

    public function fatwas(Request $request): JsonResponse
    {
        return self::apiSuccessResponse('Fatwas', ['fatwas' => $this->publishedFatwas($this->profile($request))]);
    }

    /** @return list<array<string, mixed>> */
    private function publishedFatwas(CommunityProfile $viewer, ?int $shaykhId = null): array
    {
        return FatwaPublication::publishedFor($viewer)
            ->when($shaykhId, fn ($q) => $q->whereHas('thread', fn ($thread) => $thread->where('shaykh_id', $shaykhId)))
            ->with(['thread.shaykh.profile', 'thread.question.asker:id,gender'])
            ->latest('published_at')
            ->limit(100)
            ->get()
            ->map(fn (FatwaPublication $publication) => $this->fatwaData($publication))
            ->all();
    }

    /**
     * A published fatwa with the shaykh's name, manhaj and marja'; the asker
     * only as "a brother" / "a sister" when they chose to show it.
     *
     * @return array<string, mixed>
     */
    public static function fatwaData(FatwaPublication $publication): array
    {
        $shaykh = $publication->thread->shaykh;

        return [
            'id' => $publication->id,
            'question' => $publication->question_text,
            'answer' => $publication->answer_text,
            'published_at' => $publication->published_at,
            'asker_gender' => $publication->thread->question->askerGenderLabel(),
            'shaykh' => $shaykh->only(['id', 'manhaj', 'marja']) + [
                'first_name' => $shaykh->profile?->first_name,
                'last_name' => $shaykh->profile?->last_name,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function requestData(ShaykhRequest $trustRequest): array
    {
        return $trustRequest->only([...ShaykhRequest::FIELDS, 'id', 'status', 'admin_note', 'created_at', 'updated_at']);
    }

    private function profile(Request $request): CommunityProfile
    {
        return $request->user()->communityProfile;
    }
}
