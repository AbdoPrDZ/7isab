<?php

namespace App\Modules\Community\Http\Controllers\Admin;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\FatwaPublication;
use App\Modules\Community\Models\FatwaQuestion;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\Report;
use App\Modules\Community\Models\Space;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The admin reports queue: what was reported (with the content), and the
 * action taken: hide the content, suspend or ban its author, or dismiss.
 */
class ReportAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|in:pending,actioned,dismissed',
            'page' => 'nullable|integer|min:1',
        ]);

        $page = Report::where('status', $validated['status'] ?? 'pending')
            ->with('reporter:id,first_name,last_name')
            ->oldest()
            ->paginate(20, page: $validated['page'] ?? 1);

        return self::apiSuccessResponse('Reports', [
            'items' => collect($page->items())->map(fn (Report $report) => [
                ...$report->only(['id', 'target_type', 'target_id', 'reason', 'details', 'status', 'created_at']),
                'reporter' => $report->reporter?->only(['id', 'first_name', 'last_name']),
                'target' => $this->target($report),
                'same_target_count' => Report::where('target_type', $report->target_type)->where('target_id', $report->target_id)->count(),
            ]),
            'itemsCount' => $page->total(),
            'pagesCount' => $page->lastPage(),
            'page' => $page->currentPage(),
        ]);
    }

    /** Hides the reported post or comment, or closes the reported space. */
    public function hide(Request $request, Report $report): JsonResponse
    {
        match ($report->target_type) {
            'post' => Post::whereKey($report->target_id)->update(['status' => 'hidden']),
            'comment' => Comment::whereKey($report->target_id)->update(['status' => 'hidden']),
            'space' => Space::whereKey($report->target_id)->update(['status' => 'closed']),
            // A published fatwa goes back to private; a question is closed.
            'fatwa' => FatwaPublication::whereKey($report->target_id)->update(['published_at' => null, 'asker_approved_at' => null]),
            'fatwa_question' => FatwaQuestion::whereKey($report->target_id)->update(['status' => 'closed']),
            'profile' => null,
        };

        return $this->close($request, $report, 'actioned');
    }

    public function suspend(Request $request, Report $report): JsonResponse
    {
        return $this->setAuthorStatus($request, $report, 'suspended');
    }

    public function ban(Request $request, Report $report): JsonResponse
    {
        return $this->setAuthorStatus($request, $report, 'banned');
    }

    public function dismiss(Request $request, Report $report): JsonResponse
    {
        return $this->close($request, $report, 'dismissed');
    }

    private function setAuthorStatus(Request $request, Report $report, string $status): JsonResponse
    {
        $authorId = $this->target($report)['author_id'] ?? null;

        if (! $authorId) {
            return self::apiErrorResponse('This report has no author to act on', code: 409);
        }

        CommunityProfile::whereKey($authorId)->update(['status' => $status]);

        return $this->close($request, $report, 'actioned');
    }

    /** Closes this report and every other pending report on the same target. */
    private function close(Request $request, Report $report, string $status): JsonResponse
    {
        Report::where('target_type', $report->target_type)
            ->where('target_id', $report->target_id)
            ->where('status', 'pending')
            ->update(['status' => $status, 'handled_by' => $request->user()->id]);

        return self::apiSuccessResponse('Report handled', ['item' => $report->fresh()]);
    }

    /** @return array<string, mixed>|null */
    private function target(Report $report): ?array
    {
        $author = fn (?CommunityProfile $profile) => $profile?->only(['id', 'first_name', 'last_name', 'gender', 'status']);

        return match ($report->target_type) {
            'post' => ($post = Post::with('author', 'space:id,name')->find($report->target_id)) ? [
                'type' => $post->type, 'body' => $post->body, 'payload' => $post->payload, 'status' => $post->status,
                'space' => $post->space?->name, 'author' => $author($post->author), 'author_id' => $post->author_id,
            ] : null,
            'comment' => ($comment = Comment::with('author')->find($report->target_id)) ? [
                'body' => $comment->body, 'status' => $comment->status, 'author' => $author($comment->author), 'author_id' => $comment->author_id,
            ] : null,
            'space' => ($space = Space::with('owner')->find($report->target_id)) ? [
                'name' => $space->name, 'purpose' => $space->purpose, 'status' => $space->status,
                'author' => $author($space->owner), 'author_id' => $space->owner_id,
            ] : null,
            'profile' => ($profile = CommunityProfile::find($report->target_id)) ? [
                'author' => $author($profile), 'author_id' => $profile->id,
            ] : null,
            'fatwa' => ($publication = FatwaPublication::with('thread.shaykh.profile')->find($report->target_id)) ? [
                'body' => $publication->question_text."\n\n".$publication->answer_text,
                'author' => $author($publication->thread->shaykh?->profile), 'author_id' => $publication->thread->shaykh?->profile_id,
            ] : null,
            // The only place the asker is revealed: to admins, from a shaykh's report.
            'fatwa_question' => ($question = FatwaQuestion::with('asker')->find($report->target_id)) ? [
                'body' => $question->body, 'status' => $question->status,
                'author' => $author($question->asker), 'author_id' => $question->asker_id,
            ] : null,
        };
    }
}
