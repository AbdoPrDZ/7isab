<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Import;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\ProgramTemplate;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\TestamentTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PostController extends Controller
{
    /** Only the author's public fields ever leave the server. */
    private const AUTHOR_FIELDS = 'author:id,first_name,last_name,gender';

    public function feed(Request $request): JsonResponse
    {
        $profile = $request->user()->communityProfile;

        $page = Post::visibleTo($profile)
            ->whereHas('space.members', fn ($member) => $member
                ->where('profile_id', $profile->id)
                ->where('status', 'active'))
            ->with(self::AUTHOR_FIELDS)
            ->withCount('imports')
            ->latest()
            ->simplePaginate(20);

        return Controller::apiSuccessResponse('Feed', [
            'posts' => $page->items(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    public function spacePosts(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $profile = $request->user()->communityProfile;

        if ($space->gender && $space->gender !== $profile->gender) {
            return Controller::apiErrorResponse('No access to this space', code: 403);
        }

        $page = Post::visibleTo($profile)
            ->where('space_id', $id)
            ->with(self::AUTHOR_FIELDS)
            ->withCount('imports')
            ->latest()
            ->simplePaginate(20);

        return Controller::apiSuccessResponse('Posts', [
            'posts' => $page->items(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $profile = $request->user()->communityProfile;

        if (! $space->members()->where('profile_id', $profile->id)->where('status', 'active')->exists()) {
            return Controller::apiErrorResponse('Not a member of this space', code: 403);
        }

        $validated = $request->validate([
            'type' => 'required|in:text,ayah,hadith,testament,program,event',
            'body' => 'required|string|max:5000',
            'payload' => 'sometimes|array',
            'audience' => 'sometimes|in:own_gender,everyone',
            ...$this->payloadRules($request->input('type')),
        ]);

        $payload = $validated['payload'] ?? null;

        $post = DB::transaction(function () use ($validated, $payload, $profile, $space) {
            if ($validated['type'] === 'testament') {
                $template = TestamentTemplate::create([
                    'author_id' => $profile->id,
                    'category' => $payload['category'],
                    'text' => $payload['text'],
                    'source' => $payload['source'] ?? null,
                ]);
                $payload['template_id'] = $template->id;
            } elseif ($validated['type'] === 'program') {
                $template = ProgramTemplate::create([
                    'author_id' => $profile->id,
                    'name' => $payload['name'],
                    'category' => $payload['category'],
                    'custom_category' => $payload['custom_category'] ?? null,
                    'goal' => $payload['goal'],
                    'length' => $payload['length'],
                    'tasks' => $payload['tasks'],
                ]);
                $payload['template_id'] = $template->id;
            }

            return Post::create([
                'space_id' => $space->id,
                'author_id' => $profile->id,
                'type' => $validated['type'],
                'body' => $validated['body'],
                'payload' => $payload,
                'audience' => $validated['audience'] ?? 'everyone',
                'status' => $space->posting_requires_approval ? 'pending' : 'published',
            ]);
        });

        return Controller::apiSuccessResponse('Post created', ['post' => [
            'id' => $post->id,
            'status' => $post->status,
        ]], 201);
    }

    /**
     * Payload rules per shared item type; the shapes match the app's vault records.
     *
     * @return array<string, string>
     */
    private function payloadRules(mixed $type): array
    {
        return match ($type) {
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

    public function update(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if ($post->author_id !== $profile->id) {
            return Controller::apiErrorResponse('Not post author', code: 403);
        }

        $validated = $request->validate([
            'body' => 'required|string|max:5000',
            'payload' => 'sometimes|array',
        ]);

        $post->update([
            'body' => $validated['body'],
            'payload' => $validated['payload'] ?? $post->payload,
            'edited_at' => now(),
        ]);

        return response()->json(['message' => 'Updated']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if ($post->author_id !== $profile->id) {
            return Controller::apiErrorResponse('Not post author', code: 403);
        }

        $post->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function save(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        $post->savedBy()->syncWithoutDetaching([$profile->id]);

        return response()->json(['message' => 'Post saved']);
    }

    /**
     * Records that the viewer imported a shared item (only the count is ever shown).
     * The app copies the payload into its encrypted vault itself.
     */
    public function import(Request $request, int $id): JsonResponse
    {
        $profile = $request->user()->communityProfile;
        $post = Post::visibleTo($profile)->whereIn('type', ['testament', 'program'])->findOrFail($id);

        Import::firstOrCreate(
            ['profile_id' => $profile->id, 'post_id' => $post->id],
            ['imported_at' => now()],
        );

        return Controller::apiSuccessResponse('Post imported', [
            'payload' => $post->payload,
            'imports_count' => $post->imports()->count(),
        ]);
    }
}
