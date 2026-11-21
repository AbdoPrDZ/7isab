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

class PostController extends Controller
{
    public function feed(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        $posts = Post::whereHas('space', function ($q) use ($profile) {
            $q->where('status', 'active')
                ->where(function ($q2) use ($profile) {
                    $q2->whereNull('gender')
                        ->orWhere('gender', $profile->gender);
                });
        })
            ->where('status', 'published')
            ->where(function ($q) use ($profile) {
                $q->where('audience', 'everyone')
                    ->orWhere(function ($q2) use ($profile) {
                        $q2->where('audience', 'own_gender')
                            ->where('author_id', $profile->id);
                    });
            })
            ->with('space', 'author')
            ->latest()
            ->paginate(20);

        return response()->json(['posts' => $posts]);
    }

    public function spacePosts(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if ($space->gender && $space->gender !== $profile->gender) {
            return Controller::apiErrorResponse('No access to this space', code: 403);
        }

        $posts = Post::where('space_id', $id)
            ->where('status', 'published')
            ->with('author', 'comments.author')
            ->latest()
            ->paginate(20);

        return response()->json(['posts' => $posts]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $space = Space::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if (! $space->members()->where('profile_id', $profile->id)->exists()) {
            return Controller::apiErrorResponse('Not a member of this space', code: 403);
        }

        $validated = $request->validate([
            'type' => 'required|in:text,ayah,hadith,testament,program,event',
            'body' => 'required|string|max:5000',
            'payload' => 'sometimes|array',
            'audience' => 'sometimes|in:own_gender,everyone',
        ]);

        $payload = $validated['payload'] ?? null;

        if ($validated['type'] === 'testament') {
            $this->validateTestamentPayload($payload);
            $template = TestamentTemplate::create([
                'author_id' => $profile->id,
                'category' => $payload['category'],
                'text' => $payload['text'],
                'source' => $payload['source'] ?? null,
            ]);
            $payload['template_id'] = $template->id;
        } elseif ($validated['type'] === 'program') {
            $this->validateProgramPayload($payload);
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

        $status = $space->posting_requires_approval ? 'pending' : 'published';

        $post = Post::create([
            'space_id' => $id,
            'author_id' => $profile->id,
            'type' => $validated['type'],
            'body' => $validated['body'],
            'payload' => $payload,
            'audience' => $validated['audience'] ?? 'everyone',
            'status' => $status,
        ]);

        return response()->json(['post' => [
            'id' => $post->id,
            'status' => $post->status,
        ]], 201);
    }

    private function validateTestamentPayload(?array $payload): void
    {
        if (! $payload) {
            throw new \InvalidArgumentException('Testament payload is required');
        }

        if (empty($payload['category']) || empty($payload['text'])) {
            throw new \InvalidArgumentException('Testament must have category and text');
        }

        $validCategories = ['jannah', 'nar', 'akhira', 'dunya', 'athkar'];
        if (! in_array($payload['category'], $validCategories, true)) {
            throw new \InvalidArgumentException('Invalid testament category');
        }
    }

    private function validateProgramPayload(?array $payload): void
    {
        if (! $payload) {
            throw new \InvalidArgumentException('Program payload is required');
        }

        if (empty($payload['name']) || empty($payload['category']) || empty($payload['goal']) || empty($payload['length']) || empty($payload['tasks'])) {
            throw new \InvalidArgumentException('Program must have name, category, goal, length, and tasks');
        }

        if (! is_array($payload['tasks']) || count($payload['tasks']) === 0) {
            throw new \InvalidArgumentException('Program must have at least one task');
        }

        $validCategories = ['improving', 'healing', 'custom'];
        if (! in_array($payload['category'], $validCategories, true)) {
            throw new \InvalidArgumentException('Invalid program category');
        }

        foreach ($payload['tasks'] as $task) {
            if (empty($task['name']) || empty($task['type'])) {
                throw new \InvalidArgumentException('Each task must have name and type');
            }
        }
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

        $post->savedBy()->attach($profile->id);

        return response()->json(['message' => 'Post saved']);
    }

    public function import(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        $importedPost = Post::create([
            'space_id' => $post->space_id,
            'author_id' => $profile->id,
            'type' => $post->type,
            'body' => $post->body,
            'payload' => $post->payload,
            'audience' => 'own_gender',
            'status' => 'published',
        ]);

        Import::create([
            'profile_id' => $profile->id,
            'post_id' => $id,
            'imported_at' => now(),
        ]);

        return response()->json([
            'message' => 'Post imported',
            'imported_post_id' => $importedPost->id,
            'payload' => $importedPost->payload,
        ], 201);
    }
}
