<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\FatwaMessage;
use App\Modules\Community\Models\FatwaPublication;
use App\Modules\Community\Models\FatwaQuestion;
use App\Modules\Community\Models\FatwaThread;
use App\Modules\Community\Models\Shaykh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Questions to trusted shaykhs. The asker is never shown to a shaykh (only
 * "a brother" / "a sister" when they choose). Each shaykh who takes a question
 * has their own thread with the asker; a fatwa is public only when the shaykh
 * proposes the (rewritten) text and the asker approves it.
 */
class FatwaController extends Controller
{
    public function ask(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $validated = $request->validate([
            'body' => 'required|string|min:10|max:5000',
            'show_asker_gender' => 'required|boolean',
            'target_shaykh_id' => 'nullable|integer',
            'shaykh_gender' => 'required_without:target_shaykh_id|nullable|in:male,female',
        ]);

        $target = null;
        if ($validated['target_shaykh_id'] ?? null) {
            $target = Shaykh::visibleTo($profile)->with('profile')->find($validated['target_shaykh_id']);
            if (! $target || $target->profile_id === $profile->id) {
                return self::apiSingleErrorResponse('target_shaykh_id', 'This shaykh is not available.');
            }
        }

        $shaykhGender = $target?->profile->gender ?? $validated['shaykh_gender'];

        // Only women ask female shaykhs.
        if ($shaykhGender === 'female' && $profile->gender !== 'female') {
            return self::apiSingleErrorResponse('shaykh_gender', 'Female shaykhs answer women only.');
        }

        $question = DB::transaction(function () use ($profile, $validated, $target, $shaykhGender) {
            $question = FatwaQuestion::create([
                'asker_id' => $profile->id,
                'shaykh_gender' => $shaykhGender,
                'target_shaykh_id' => $target?->id,
                'body' => trim($validated['body']),
                'show_asker_gender' => $validated['show_asker_gender'],
                'status' => 'open',
            ]);

            if ($target) {
                FatwaThread::create(['question_id' => $question->id, 'shaykh_id' => $target->id, 'status' => 'open', 'last_message_at' => now()]);
            }

            return $question;
        });

        return self::apiSuccessResponse('Question sent', ['question' => ['id' => $question->id, 'status' => $question->status]], 201);
    }

    /** The asker's questions, each with the threads of the shaykhs who took it. */
    public function mine(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $questions = FatwaQuestion::where('asker_id', $profile->id)
            ->with(['threads.shaykh.profile', 'threads.publication', 'targetShaykh.profile'])
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (FatwaQuestion $question) => [
                'id' => $question->id,
                'body' => $question->body,
                'status' => $question->status,
                'shaykh_gender' => $question->shaykh_gender,
                'show_asker_gender' => $question->show_asker_gender,
                'target_shaykh' => $question->targetShaykh?->publicData(),
                'created_at' => $question->created_at,
                'threads' => $question->threads
                    ->where('status', '!=', 'referred')
                    ->sortByDesc('last_message_at')
                    ->map(fn (FatwaThread $thread) => $this->threadSummary($thread, 'asker'))
                    ->values(),
            ]);

        return self::apiSuccessResponse('Questions', ['questions' => $questions]);
    }

    public function close(Request $request, int $id): JsonResponse
    {
        $question = FatwaQuestion::where('asker_id', $this->profile($request)->id)->findOrFail($id);
        $question->update(['status' => 'closed']);

        return self::apiSuccessResponse('Question closed');
    }

    /** A shaykh's inbox: their threads, and open questions for their gender they haven't taken or declined. */
    public function inbox(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $shaykh = $this->shaykhOf($profile);

        $threads = $shaykh->threads()
            ->whereIn('status', ['open', 'answered'])
            ->with(['question.asker:id,gender', 'publication'])
            ->orderByDesc('last_message_at')
            ->limit(200)
            ->get()
            ->map(fn (FatwaThread $thread) => $this->threadSummary($thread, 'shaykh'));

        $open = FatwaQuestion::whereNull('target_shaykh_id')
            // Several shaykhs can answer an open question, so an answered one stays available.
            ->whereIn('status', ['open', 'answered'])
            ->where('shaykh_gender', $profile->gender)
            ->where('asker_id', '!=', $profile->id)
            ->whereDoesntHave('threads', fn ($thread) => $thread->where('shaykh_id', $shaykh->id))
            ->with('asker:id,gender')
            ->oldest()
            ->limit(100)
            ->get()
            ->map(fn (FatwaQuestion $question) => $this->questionForShaykh($question));

        return self::apiSuccessResponse('Inbox', ['threads' => $threads, 'open_questions' => $open]);
    }

    /** A shaykh takes an open question: their own thread with the asker, starting with this message. */
    public function take(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $shaykh = $this->shaykhOf($profile);
        $question = $this->openQuestionFor($shaykh, $profile, $id);
        $validated = $request->validate(['body' => 'required|string|max:10000', 'answered' => 'sometimes|boolean']);

        $thread = DB::transaction(function () use ($question, $shaykh, $validated) {
            $thread = FatwaThread::create(['question_id' => $question->id, 'shaykh_id' => $shaykh->id, 'status' => 'open']);
            $this->addMessage($thread, 'shaykh', $validated['body'], $validated['answered'] ?? false);

            return $thread;
        });

        return self::apiSuccessResponse('Thread started', ['thread' => ['id' => $thread->id]], 201);
    }

    /** A shaykh declines an open question: it leaves their inbox. */
    public function declineQuestion(Request $request, int $id): JsonResponse
    {
        $profile = $this->profile($request);
        $shaykh = $this->shaykhOf($profile);
        $question = $this->openQuestionFor($shaykh, $profile, $id);

        FatwaThread::create(['question_id' => $question->id, 'shaykh_id' => $shaykh->id, 'status' => 'declined']);

        return self::apiSuccessResponse('Declined');
    }

    public function thread(Request $request, int $id): JsonResponse
    {
        [$thread, $role] = $this->threadFor($request, $id);
        $thread->load(['messages', 'publication', 'shaykh.profile', 'question.asker:id,gender']);

        return self::apiSuccessResponse('Thread', ['thread' => [
            ...$this->threadSummary($thread, $role),
            'messages' => $thread->messages->map(fn (FatwaMessage $message) => $message->only(['id', 'from', 'body', 'created_at']))->values(),
        ]]);
    }

    public function message(Request $request, int $id): JsonResponse
    {
        [$thread, $role] = $this->threadFor($request, $id);

        if (! in_array($thread->status, ['open', 'answered'], true) || $thread->question->status === 'closed') {
            return self::apiErrorResponse('This conversation is closed', ['reason' => 'closed'], 409);
        }

        $validated = $request->validate(['body' => 'required|string|max:10000', 'answered' => 'sometimes|boolean']);
        $this->addMessage($thread, $role, $validated['body'], $role === 'shaykh' && ($validated['answered'] ?? false));

        return $this->thread($request, $id);
    }

    public function decline(Request $request, int $id): JsonResponse
    {
        [$thread] = $this->threadFor($request, $id, shaykhOnly: true);
        $thread->update(['status' => 'declined']);

        return self::apiSuccessResponse('Declined');
    }

    /** Hands the question to another shaykh the asker may ask (a new thread for them). */
    public function refer(Request $request, int $id): JsonResponse
    {
        [$thread] = $this->threadFor($request, $id, shaykhOnly: true);
        $validated = $request->validate(['shaykh_id' => 'required|integer']);
        $asker = $thread->question->asker;

        $other = Shaykh::trusted()->with('profile')->find($validated['shaykh_id']);
        if (! $other || $other->id === $thread->shaykh_id || ! $asker || ! $other->isVisibleTo($asker) || $other->profile_id === $asker->id) {
            return self::apiSingleErrorResponse('shaykh_id', 'This shaykh cannot take the question.');
        }

        DB::transaction(function () use ($thread, $other) {
            FatwaThread::firstOrCreate(
                ['question_id' => $thread->question_id, 'shaykh_id' => $other->id],
                ['status' => 'open', 'last_message_at' => now()],
            );
            $thread->update(['status' => 'referred', 'referred_to_id' => $other->id]);
        });

        return self::apiSuccessResponse('Referred');
    }

    /** The shaykh proposes the fatwa for publication, rewriting the question and answer as needed. */
    public function proposePublish(Request $request, int $id): JsonResponse
    {
        [$thread] = $this->threadFor($request, $id, shaykhOnly: true);

        if (! $thread->messages()->where('from', 'shaykh')->exists()) {
            return self::apiErrorResponse('Answer the question before proposing it', code: 409);
        }
        if ($thread->publication?->published_at) {
            return self::apiErrorResponse('Already published', code: 409);
        }

        $validated = $request->validate([
            'question_text' => 'required|string|max:5000',
            'answer_text' => 'required|string|max:20000',
        ]);

        $publication = FatwaPublication::updateOrCreate(
            ['thread_id' => $thread->id],
            [
                'question_text' => trim($validated['question_text']),
                'answer_text' => trim($validated['answer_text']),
                'shaykh_approved_at' => now(),
                'asker_approved_at' => null,
                'published_at' => null,
            ],
        );

        return self::apiSuccessResponse('Proposed', ['publication' => $this->publicationData($publication)]);
    }

    /** The asker approves the proposed text: the fatwa is published. */
    public function approve(Request $request, int $id): JsonResponse
    {
        $publication = $this->askerPublication($request, $id);
        $publication->update(['asker_approved_at' => now(), 'published_at' => now()]);

        return self::apiSuccessResponse('Published', ['publication' => $this->publicationData($publication)]);
    }

    /** The asker refuses: it stays private between them (the shaykh may propose another text). */
    public function refuse(Request $request, int $id): JsonResponse
    {
        $this->askerPublication($request, $id)->delete();

        return self::apiSuccessResponse('Refused');
    }

    private function addMessage(FatwaThread $thread, string $from, string $body, bool $answered): void
    {
        FatwaMessage::create(['thread_id' => $thread->id, 'from' => $from, 'body' => trim($body)]);

        $thread->update([
            'last_message_at' => now(),
            'status' => $answered ? 'answered' : $thread->status,
        ]);

        if ($answered) {
            $thread->question()->where('status', 'open')->update(['status' => 'answered']);
        }
    }

    /** @return array<string, mixed> */
    private function threadSummary(FatwaThread $thread, string $role): array
    {
        return [
            'id' => $thread->id,
            'role' => $role,
            'status' => $thread->status,
            'last_message_at' => $thread->last_message_at,
            'question' => $role === 'shaykh'
                ? $this->questionForShaykh($thread->question)
                : $thread->question->only(['id', 'body', 'status', 'created_at']),
            'shaykh' => $role === 'asker' ? $thread->shaykh?->publicData() : null,
            'publication' => $thread->publication ? $this->publicationData($thread->publication) : null,
        ];
    }

    /** What a shaykh sees of a question: never the asker, only their gender if shown. @return array<string, mixed> */
    private function questionForShaykh(FatwaQuestion $question): array
    {
        return [
            'id' => $question->id,
            'body' => $question->body,
            'status' => $question->status,
            'asker_gender' => $question->askerGenderLabel(),
            'targeted' => $question->target_shaykh_id !== null,
            'created_at' => $question->created_at,
        ];
    }

    /** @return array<string, mixed> */
    private function publicationData(FatwaPublication $publication): array
    {
        return $publication->only(['id', 'question_text', 'answer_text', 'shaykh_approved_at', 'asker_approved_at', 'published_at']);
    }

    /** @return array{0: FatwaThread, 1: 'asker'|'shaykh'} */
    private function threadFor(Request $request, int $id, bool $shaykhOnly = false): array
    {
        $profile = $this->profile($request);
        $thread = FatwaThread::with(['question.asker', 'shaykh.profile', 'publication'])->findOrFail($id);

        if ($thread->shaykh?->profile_id === $profile->id && $thread->shaykh->isTrusted()) {
            return [$thread, 'shaykh'];
        }

        abort_if($shaykhOnly || $thread->question->asker_id !== $profile->id, 404);

        return [$thread, 'asker'];
    }

    private function askerPublication(Request $request, int $id): FatwaPublication
    {
        $profile = $this->profile($request);

        return FatwaPublication::whereNull('published_at')
            ->whereNotNull('shaykh_approved_at')
            ->whereHas('thread.question', fn ($question) => $question->where('asker_id', $profile->id))
            ->findOrFail($id);
    }

    private function openQuestionFor(Shaykh $shaykh, CommunityProfile $profile, int $id): FatwaQuestion
    {
        return FatwaQuestion::whereNull('target_shaykh_id')
            // Several shaykhs can answer an open question, so an answered one stays available.
            ->whereIn('status', ['open', 'answered'])
            ->where('shaykh_gender', $profile->gender)
            ->where('asker_id', '!=', $profile->id)
            ->whereDoesntHave('threads', fn ($thread) => $thread->where('shaykh_id', $shaykh->id))
            ->findOrFail($id);
    }

    private function shaykhOf(CommunityProfile $profile): Shaykh
    {
        $shaykh = $profile->shaykh;
        abort_unless($shaykh?->isTrusted(), 403, 'Only trusted shaykhs answer questions');

        return $shaykh;
    }

    private function profile(Request $request): CommunityProfile
    {
        return $request->user()->communityProfile;
    }
}
