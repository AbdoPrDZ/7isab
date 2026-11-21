<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);

        $comments = Comment::where('post_id', $id)
            ->whereNull('parent_id')
            ->with('author', 'replies.author')
            ->oldest()
            ->paginate(50);

        return response()->json(['comments' => $comments]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        $validated = $request->validate([
            'body' => 'required|string|max:2000',
            'parent_id' => 'sometimes|integer|exists:comments,id',
        ]);

        $comment = Comment::create([
            'post_id' => $id,
            'author_id' => $profile->id,
            'author_gender' => $profile->gender,
            'parent_id' => $validated['parent_id'] ?? null,
            'body' => $validated['body'],
            'status' => 'published',
        ]);

        return response()->json(['comment' => [
            'id' => $comment->id,
            'body' => $comment->body,
            'author' => [
                'id' => $profile->id,
                'name' => $profile->first_name.' '.$profile->last_name,
            ],
        ]], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $comment = Comment::findOrFail($id);
        $user = $request->user();
        $profile = $user->communityProfile;

        if ($comment->author_id !== $profile->id) {
            return Controller::apiErrorResponse('Not comment author', code: 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
