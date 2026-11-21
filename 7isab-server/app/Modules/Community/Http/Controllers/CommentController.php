<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Services\Safety;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Comments, always separated by gender: a viewer only ever reads, writes and
 * replies among the comments of their own gender. Replies form a tree.
 */
class CommentController extends Controller
{
    /** Comments returned for one post (the app builds the tree from parent_id). */
    private const LIMIT = 300;

    public function __construct(private Safety $safety) {}

    public function index(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::visibleTo($profile)->findOrFail($id);
        $hidden = $this->safety->hiddenAuthorIds($profile);

        $comments = Comment::where('post_id', $post->id)
            ->where('author_gender', $profile->gender)
            ->with('author:id,first_name,last_name,gender,status')
            ->withCount(['replies as visible_replies_count' => fn ($q) => $q->where('status', 'published')])
            ->oldest()
            ->limit(self::LIMIT)
            ->get()
            // A hidden comment stays only as a placeholder when replies hang under it.
            ->filter(fn (Comment $comment) => $comment->status === 'published' || $comment->visible_replies_count > 0)
            ->reject(fn (Comment $comment) => $comment->status === 'published' && in_array($comment->author_id, $hidden, true))
            ->map(fn (Comment $comment) => $this->present($comment, $profile))
            ->values();

        return self::apiSuccessResponse('Comments', ['comments' => $comments]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $post = Post::visibleTo($profile)->findOrFail($id);

        $validated = $request->validate([
            'body' => 'required|string|max:2000',
            'parent_id' => 'nullable|integer',
        ]);

        if ($validated['parent_id'] ?? null) {
            // A reply stays on the same post and among the same gender.
            $parent = Comment::where('post_id', $post->id)
                ->where('author_gender', $profile->gender)
                ->where('status', 'published')
                ->find($validated['parent_id']);

            if (! $parent) {
                return self::apiSingleErrorResponse('parent_id', 'This comment is not available.');
            }
        }

        $comment = Comment::create([
            'post_id' => $post->id,
            'author_id' => $profile->id,
            'author_gender' => $profile->gender,
            'parent_id' => $validated['parent_id'] ?? null,
            'body' => trim($validated['body']),
            'status' => 'published',
        ]);

        return self::apiSuccessResponse('Comment added', ['comment' => $this->present($comment->load('author'), $profile)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $comment = Comment::where('author_id', $profile->id)->where('status', 'published')->findOrFail($id);

        $validated = $request->validate(['body' => 'required|string|max:2000']);
        $comment->update(['body' => trim($validated['body']), 'edited_at' => now()]);

        return self::apiSuccessResponse('Comment updated', ['comment' => $this->present($comment->load('author'), $profile)]);
    }

    /**
     * The author deletes their comment; the space's owner or a moderator (of the
     * same gender, the only comments they can see) hides it. Replies stay.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $comment = Comment::where('author_gender', $profile->gender)->where('status', 'published')->findOrFail($id);

        if ($comment->author_id !== $profile->id) {
            $space = $comment->post->space;
            abort_unless($space->isVisibleTo($profile) && $space->isManagedBy($profile), 403);
        }

        $comment->update(['status' => 'hidden']);

        return self::apiSuccessResponse('Comment removed');
    }

    /** @return array<string, mixed> */
    private function present(Comment $comment, CommunityProfile $viewer): array
    {
        $gone = $comment->status !== 'published' || $comment->author?->status === 'left';

        return [
            'id' => $comment->id,
            'parent_id' => $comment->parent_id,
            'body' => $gone ? null : $comment->body,
            'deleted' => $gone,
            'author' => $gone || ! $comment->author ? null : $comment->author->only(['id', 'first_name', 'last_name']),
            'mine' => ! $gone && $comment->author_id === $viewer->id,
            'edited_at' => $comment->edited_at,
            'created_at' => $comment->created_at,
        ];
    }

    private function profile(Request $request): CommunityProfile
    {
        return $request->user()->communityProfile;
    }
}
