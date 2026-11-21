<?php

namespace App\Modules\Community\Services;

use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Post;
use Illuminate\Database\Eloquent\Builder;

/**
 * Shapes posts for one viewer: only the author's public fields, the viewer's
 * own gender's comment count, and "deleted by author" for members who left.
 */
class PostPresenter
{
    public function __construct(private Safety $safety) {}

    /** Eager loads and counts a post list needs, for this viewer. */
    public function prepare(Builder $query, CommunityProfile $viewer): Builder
    {
        return $query
            ->whereNotIn('author_id', $this->safety->hiddenAuthorIds($viewer))
            ->with(['author:id,first_name,last_name,gender,status', 'space:id,name,slug,type'])
            ->withCount([
                'imports',
                'comments as comments_count' => fn (Builder $comments) => $comments
                    ->where('author_gender', $viewer->gender)
                    ->where('status', 'published'),
                'savedBy as saved_count' => fn (Builder $saved) => $saved->where('saved_posts.profile_id', $viewer->id),
            ]);
    }

    /** @return array<string, mixed> */
    public function present(Post $post, CommunityProfile $viewer): array
    {
        $left = $post->author?->status === 'left';

        return [
            'id' => $post->id,
            'space' => $post->space?->only(['id', 'name', 'slug', 'type']),
            'type' => $post->type,
            'body' => $left ? null : $post->body,
            'payload' => $left ? null : $post->payload,
            'audience' => $post->audience,
            'status' => $post->status,
            'edited_at' => $post->edited_at,
            'created_at' => $post->created_at,
            'author' => $left || ! $post->author ? null : $post->author->only(['id', 'first_name', 'last_name', 'gender']),
            'deleted_by_author' => $left,
            'imports_count' => $post->imports_count ?? 0,
            'comments_count' => $post->comments_count ?? 0,
            'saved' => ($post->saved_count ?? 0) > 0,
            'mine' => $post->author_id === $viewer->id,
        ];
    }
}
