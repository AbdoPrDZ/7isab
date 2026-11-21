<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\Quran\Ayah;
use App\Models\Quran\Surah;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Import;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\ProgramTemplate;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\TestamentTemplate;
use App\Modules\Community\Services\PostPresenter;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Posts inside groups and pages: the feed, a space's posts, writing, editing
 * and removing, the approval queue, saving, and importing shared items.
 * Every read goes through Post::visibleTo (the viewer's own spaces only) and their mutes and blocks.
 */
class PostController extends Controller
{
    /** The longest ayah card, in ayat. */
    private const MAX_AYAT = 10;

    public function __construct(private PostPresenter $presenter) {}

    public function feed(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $query = Post::visibleTo($profile)->whereHas('space.members', fn ($member) => $member
            ->where('profile_id', $profile->id)
            ->where('status', 'active'));

        return $this->page($query, $profile);
    }

    /** Upcoming events and lessons from the viewer's groups and pages, soonest first. */
    public function events(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        // Times are stored as UTC ISO strings ("...Z"), so they compare as text.
        $query = Post::visibleTo($profile)
            ->where('type', 'event')
            ->whereRaw("(payload->>'starts_at') >= ?", [now()->utc()->toIso8601ZuluString()])
            ->whereHas('space.members', fn ($member) => $member
                ->where('profile_id', $profile->id)
                ->where('status', 'active'));

        $posts = $this->presenter->prepare($query, $profile)
            ->orderByRaw("payload->>'starts_at'")
            ->limit(50)
            ->get();

        return self::apiSuccessResponse('Events', [
            'posts' => $posts->map(fn (Post $post) => $this->presenter->present($post, $profile))->values(),
            'has_more' => false,
        ]);
    }

    /** A space's published posts, plus the viewer's own posts still waiting for approval. */
    public function spacePosts(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = Space::visibleTo($profile)->findOrFail($id);

        // A space's description is public to its gender; its posts are for the people in it.
        if (! $space->hasActiveMember($profile)) {
            return self::apiErrorResponse('Join or follow this space to read its posts', ['reason' => 'not_in_space'], 403);
        }

        $query = Post::query()
            ->where('space_id', $space->id)
            ->where(fn ($q) => $q
                ->whereIn('id', Post::visibleTo($profile)->select('id'))
                ->orWhere(fn ($own) => $own->where('author_id', $profile->id)->where('status', 'pending')));

        return $this->page($query, $profile);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = $this->presenter->prepare(Post::query(), $profile)
            ->where(fn ($q) => $q
                ->whereIn('id', Post::visibleTo($profile)->select('id'))
                ->orWhere(fn ($own) => $own->where('author_id', $profile->id)))
            ->findOrFail($id);

        return self::apiSuccessResponse('Post', ['post' => $this->presenter->present($post, $profile)]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = Space::visibleTo($profile)->findOrFail($id);

        if (! $space->allowsPostingBy($profile)) {
            return self::apiErrorResponse('You cannot post in this space', ['reason' => 'posting_closed'], 403);
        }

        $type = $request->input('type');
        $validated = $request->validate([
            'type' => 'required|in:text,ayah,hadith,testament,program,event',
            'body' => $type === 'text' ? 'required|string|max:5000' : 'nullable|string|max:5000',
            'payload' => 'sometimes|array',
            'audience' => 'sometimes|in:own_gender,everyone',
            ...$this->payloadRules($type),
        ]);

        $payload = $this->completePayload($validated['type'], $validated['payload'] ?? null);

        $post = DB::transaction(function () use ($validated, $payload, $profile, $space) {
            if ($validated['type'] === 'testament') {
                $payload['template_id'] = TestamentTemplate::create([
                    'author_id' => $profile->id,
                    'category' => $payload['category'],
                    'text' => $payload['text'],
                    'source' => $payload['source'] ?? null,
                ])->id;
            } elseif ($validated['type'] === 'program') {
                $payload['template_id'] = ProgramTemplate::create([
                    'author_id' => $profile->id,
                    'name' => $payload['name'],
                    'category' => $payload['category'],
                    'custom_category' => $payload['custom_category'] ?? null,
                    'goal' => $payload['goal'],
                    'length' => $payload['length'],
                    'tasks' => $payload['tasks'],
                ])->id;
            }

            return Post::create([
                'space_id' => $space->id,
                'author_id' => $profile->id,
                'type' => $validated['type'],
                'body' => trim($validated['body'] ?? ''),
                'payload' => $payload,
                // In a one-gender space everyone is of that gender; the choice only matters on an open page.
                'audience' => $space->gender ? 'everyone' : ($validated['audience'] ?? 'everyone'),
                // The owner and moderators publish directly; others wait when the page requires approval.
                'status' => $space->posting_requires_approval && ! $space->isManagedBy($profile) ? 'pending' : 'published',
            ]);
        });

        return self::apiSuccessResponse('Post created', ['post' => [
            'id' => $post->id,
            'status' => $post->status,
        ]], 201);
    }

    /** The author edits the text (shared items keep their content); the post is marked edited. */
    public function update(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::where('author_id', $profile->id)->where('status', '!=', 'hidden')->findOrFail($id);

        $validated = $request->validate([
            'body' => $post->type === 'text' ? 'required|string|max:5000' : 'nullable|string|max:5000',
        ]);

        $post->update(['body' => trim($validated['body'] ?? ''), 'edited_at' => now()]);

        return $this->show($request, $post->id);
    }

    /** The author deletes their post; the space's owner or a moderator hides it. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::findOrFail($id);

        if ($post->author_id === $profile->id) {
            $post->delete();

            return self::apiSuccessResponse('Deleted');
        }

        abort_unless($post->space->isVisibleTo($profile) && $post->space->isManagedBy($profile), 404);
        $post->update(['status' => 'hidden']);

        return self::apiSuccessResponse('Hidden');
    }

    /** Posts waiting for approval in a space the viewer manages. */
    public function pending(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $space = Space::visibleTo($profile)->findOrFail($id);
        abort_unless($space->isManagedBy($profile), 403);

        // Moderators are of the owner's gender: posts meant only for the other gender stay out of their queue.
        $query = Post::where('space_id', $space->id)
            ->where('status', 'pending')
            ->where(fn ($q) => $q->where('audience', 'everyone')
                ->orWhereHas('author', fn ($author) => $author->where('gender', $profile->gender)));

        return $this->page($query, $profile, oldestFirst: true);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, 'published');
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, 'hidden');
    }

    public function save(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::visibleTo($profile)->findOrFail($id);
        $post->savedBy()->syncWithoutDetaching([$profile->id => ['created_at' => now()]]);

        return self::apiSuccessResponse('Saved');
    }

    public function unsave(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        Post::findOrFail($id)->savedBy()->detach($profile->id);

        return self::apiSuccessResponse('Removed from saved');
    }

    public function saved(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $query = Post::visibleTo($profile)->whereHas('savedBy', fn ($saved) => $saved->where('saved_posts.profile_id', $profile->id));

        return $this->page($query, $profile);
    }

    /**
     * Records that the viewer imported a shared item (only the count is ever shown).
     * The app copies the payload into its encrypted vault itself.
     */
    public function import(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::visibleTo($profile)->whereIn('type', ['testament', 'program'])->findOrFail($id);

        Import::firstOrCreate(
            ['profile_id' => $profile->id, 'post_id' => $post->id],
            ['imported_at' => now()],
        );

        return self::apiSuccessResponse('Post imported', [
            'payload' => $post->payload,
            'imports_count' => $post->imports()->count(),
        ]);
    }

    private function review(Request $request, int $id, string $status): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::where('status', 'pending')->findOrFail($id);
        abort_unless($post->space->isVisibleTo($profile) && $post->space->isManagedBy($profile), 403);

        $post->update(['status' => $status]);

        return self::apiSuccessResponse($status === 'published' ? 'Approved' : 'Rejected');
    }

    private function page($query, CommunityProfile $profile, bool $oldestFirst = false): JsonResponse
    {
        /** @var Paginator $page */
        $page = $this->presenter->prepare($query, $profile)
            ->orderBy('created_at', $oldestFirst ? 'asc' : 'desc')
            ->orderBy('id', $oldestFirst ? 'asc' : 'desc')
            ->simplePaginate(20);

        return self::apiSuccessResponse('Posts', [
            'posts' => collect($page->items())->map(fn (Post $post) => $this->presenter->present($post, $profile))->values(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    /**
     * Payload rules per type; shared items match the app's vault records.
     *
     * @return array<string, mixed>
     */
    private function payloadRules(mixed $type): array
    {
        return match ($type) {
            'ayah' => [
                'payload' => 'required|array',
                'payload.surah' => 'required|integer|min:1|max:114',
                'payload.from' => 'required|integer|min:1',
                'payload.to' => 'nullable|integer|gte:payload.from',
            ],
            'hadith' => [
                'payload' => 'required|array',
                'payload.text' => 'required|string|max:5000',
                'payload.book' => 'required|string|max:200',
                'payload.number' => 'required|string|max:50',
                'payload.grade' => 'nullable|string|max:100',
            ],
            'event' => [
                'payload' => 'required|array',
                'payload.title' => 'required|string|max:200',
                'payload.starts_at' => 'required|date|after:now',
                'payload.ends_at' => 'nullable|date|after:payload.starts_at',
                'payload.place' => 'nullable|string|max:300',
                'payload.link' => 'nullable|url:https|max:500',
                'payload.details' => 'nullable|string|max:3000',
            ],
            'testament' => [
                'payload' => 'required|array',
                'payload.category' => 'required|in:jannah,nar,akhira,dunya,athkar',
                'payload.text' => 'required|string|max:5000',
                'payload.source' => 'nullable|string|max:500',
            ],
            'program' => [
                'payload' => 'required|array',
                'payload.name' => 'required|string|max:200',
                'payload.category' => 'required|in:improving,healing,custom',
                'payload.custom_category' => 'nullable|required_if:payload.category,custom|string|max:100',
                'payload.goal' => 'required|string|max:2000',
                'payload.length' => 'required|integer|min:1|max:3650',
                'payload.tasks' => 'required|array|min:1|max:50',
                'payload.tasks.*.name' => 'required|string|max:200',
                'payload.tasks.*.type' => 'required|string|max:50',
                'payload.tasks.*.reward' => 'nullable|integer|min:0',
            ],
            default => [],
        };
    }

    /**
     * Keeps only the fields each type defines. An ayah card always carries the
     * server's exact Quran text, never text sent by the client.
     *
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>|null
     */
    private function completePayload(string $type, ?array $payload): ?array
    {
        return match ($type) {
            'text' => null,
            'ayah' => $this->ayahPayload((int) $payload['surah'], (int) $payload['from'], (int) ($payload['to'] ?? $payload['from'])),
            'hadith' => array_intersect_key($payload, array_flip(['text', 'book', 'number', 'grade'])),
            'event' => $this->eventPayload($payload),
            'testament' => array_intersect_key($payload, array_flip(['category', 'text', 'source'])),
            'program' => array_intersect_key($payload, array_flip(['name', 'category', 'custom_category', 'goal', 'length', 'tasks'])),
        };
    }

    /** @return array<string, mixed> */
    private function ayahPayload(int $surahId, int $from, int $to): array
    {
        $surah = Surah::find($surahId);
        $fail = fn (string $message) => throw ValidationException::withMessages(['payload.from' => $message]);

        if (! $surah) {
            $fail('This surah is not available.');
        }
        if ($to > $surah->verses_count || $from > $surah->verses_count) {
            $fail('This surah has '.$surah->verses_count.' ayat.');
        }
        if ($to - $from + 1 > self::MAX_AYAT) {
            $fail('An ayah card holds at most '.self::MAX_AYAT.' ayat.');
        }

        $ayat = Ayah::where('surah_id', $surahId)->whereBetween('number', [$from, $to])->orderBy('number')->get(['number', 'text']);

        if ($ayat->count() !== $to - $from + 1) {
            $fail('The Quran text is not available on the server.');
        }

        return [
            'surah' => $surahId,
            'from' => $from,
            'to' => $to,
            'surah_name' => $surah->name_arabic,
            'ayat' => $ayat->map(fn (Ayah $ayah) => ['number' => $ayah->number, 'text' => $ayah->text])->all(),
        ];
    }

    /**
     * Times are stored in UTC (ISO 8601); each phone shows and reminds in its own time zone.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function eventPayload(array $payload): array
    {
        $utc = fn (?string $time) => $time ? Carbon::parse($time)->utc()->toIso8601ZuluString() : null;

        return [
            'title' => trim($payload['title']),
            'starts_at' => $utc($payload['starts_at']),
            'ends_at' => $utc($payload['ends_at'] ?? null),
            'place' => isset($payload['place']) ? trim($payload['place']) ?: null : null,
            'link' => $payload['link'] ?? null,
            'details' => isset($payload['details']) ? trim($payload['details']) ?: null : null,
        ];
    }

    private function profile(Request $request): CommunityProfile
    {
        return $request->user()->communityProfile;
    }
}
