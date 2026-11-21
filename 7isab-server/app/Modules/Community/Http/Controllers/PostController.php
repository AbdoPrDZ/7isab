<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\Space;
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

        $status = $space->posting_requires_approval ? 'pending' : 'published';

        $post = Post::create([
            'space_id' => $id,
            'author_id' => $profile->id,
            'type' => $validated['type'],
            'body' => $validated['body'],
            'payload' => $validated['payload'] ?? null,
            'audience' => $validated['audience'] ?? 'everyone',
            'status' => $status,
        ]);

        return response()->json(['post' => [
            'id' => $post->id,
            'status' => $post->status,
        ]], 201);
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

        Post::create([
            'space_id' => $post->space_id,
            'author_id' => $profile->id,
            'type' => $post->type,
            'body' => $post->body,
            'payload' => $post->payload,
            'audience' => 'own_gender',
            'status' => 'published',
        ]);

        return response()->json(['message' => 'Post imported'], 201);
    }
}
