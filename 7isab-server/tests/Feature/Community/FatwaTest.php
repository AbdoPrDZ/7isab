<?php

namespace Tests\Feature\Community;

use App\Models\User;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\FatwaPublication;
use App\Modules\Community\Models\FatwaThread;
use App\Modules\Community\Models\Shaykh;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class FatwaTest extends TestCase
{
    private CommunityProfile $brother;

    private CommunityProfile $sister;

    private Shaykh $shaykh;

    private Shaykh $shaykha;

    protected function setUp(): void
    {
        parent::setUp();

        $this->brother = $this->profile('male', 'Asker');
        $this->sister = $this->profile('female', 'Askera');
        $this->shaykh = $this->makeShaykh('male', 'Yusuf');
        $this->shaykha = $this->makeShaykh('female', 'Aisha');
    }

    public function test_trust_request_review_and_withdrawal(): void
    {
        $candidate = $this->profile('male', 'Candidate');

        $this->as($candidate)->postJson('/api/v1/community/shaykh-requests', ['marja' => 'X'])->assertUnprocessable();
        $id = $this->as($candidate)->postJson('/api/v1/community/shaykh-requests', ['manhaj' => 'Salafi', 'marja' => 'Senior scholars', 'studies' => 'Madinah'])
            ->assertCreated()
            ->json('request.id');
        $this->as($candidate)->postJson('/api/v1/community/shaykh-requests', ['manhaj' => 'A', 'marja' => 'B'])->assertStatus(409);

        $admin = $this->adminHeaders($this->createAdmin());
        $this->forgetAuth();
        $this->withHeaders($admin)->postJson("/api/v1/admin/community/shaykh-requests/{$id}/approve")->assertCreated();

        $this->as($this->sister)->getJson('/api/v1/community/shaykhs')->assertOk()->assertJsonCount(3, 'shaykhs');
        $this->as($candidate)->getJson('/api/v1/community/shaykh-requests/mine')->assertJsonPath('is_shaykh', true);

        $shaykh = Shaykh::where('profile_id', $candidate->id)->sole();
        $this->forgetAuth();
        $this->withHeaders($admin)->postJson("/api/v1/admin/community/shaykhs/{$shaykh->id}/withdraw")->assertOk();
        $this->as($candidate)->getJson('/api/v1/community/fatwa/inbox')->assertForbidden();
        $this->as($this->sister)->getJson('/api/v1/community/shaykhs')->assertJsonCount(2, 'shaykhs');
    }

    public function test_female_shaykhs_are_for_women_only(): void
    {
        $this->assertSame(['Yusuf'], array_column($this->as($this->brother)->getJson('/api/v1/community/shaykhs')->json('shaykhs'), 'first_name'));
        $this->as($this->brother)->getJson("/api/v1/community/shaykhs/{$this->shaykha->id}")->assertNotFound();

        $this->ask($this->brother, ['shaykh_gender' => 'female'])->assertUnprocessable();
        $this->ask($this->brother, ['target_shaykh_id' => $this->shaykha->id])->assertUnprocessable();
        $this->ask($this->sister, ['target_shaykh_id' => $this->shaykha->id])->assertCreated();
    }

    public function test_a_targeted_question_reaches_only_that_shaykh_and_never_shows_the_asker(): void
    {
        $other = $this->makeShaykh('male', 'Other');
        $this->ask($this->brother, ['target_shaykh_id' => $this->shaykh->id, 'show_asker_gender' => false])->assertCreated();

        $inbox = $this->as($this->shaykh->profile)->getJson('/api/v1/community/fatwa/inbox')->assertOk();
        $this->assertCount(1, $inbox->json('threads'));
        $this->assertNull($inbox->json('threads.0.question.asker_gender'));
        $this->assertStringNotContainsString('Asker', $inbox->getContent());
        $this->assertStringNotContainsString('asker_id', $inbox->getContent());

        $this->as($other->profile)->getJson('/api/v1/community/fatwa/inbox')
            ->assertJsonCount(0, 'threads')
            ->assertJsonCount(0, 'open_questions');

        $thread = $this->as($this->shaykh->profile)->getJson('/api/v1/community/fatwa-threads/'.$inbox->json('threads.0.id'))->assertOk();
        $this->assertStringNotContainsString('Asker', $thread->getContent());
    }

    public function test_an_open_question_gets_one_thread_per_shaykh(): void
    {
        $second = $this->makeShaykh('male', 'Second');
        $questionId = $this->ask($this->sister, ['shaykh_gender' => 'male', 'show_asker_gender' => true])->json('question.id');

        // Only shaykhs of the chosen gender see it, with "a sister" and no name.
        $this->as($this->shaykha->profile)->getJson('/api/v1/community/fatwa/inbox')->assertJsonCount(0, 'open_questions');
        $this->as($this->shaykh->profile)->getJson('/api/v1/community/fatwa/inbox')
            ->assertJsonPath('open_questions.0.id', $questionId)
            ->assertJsonPath('open_questions.0.asker_gender', 'female');

        $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-questions/{$questionId}/take", ['body' => 'First answer', 'answered' => true])->assertCreated();
        $this->as($second->profile)->postJson("/api/v1/community/fatwa-questions/{$questionId}/take", ['body' => 'Second answer'])->assertCreated();
        $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-questions/{$questionId}/take", ['body' => 'Again'])->assertNotFound();

        $threads = $this->as($this->sister)->getJson('/api/v1/community/fatwa/mine')->json('questions.0.threads');
        $this->assertEqualsCanonicalizing(['Yusuf', 'Second'], array_column(array_column($threads, 'shaykh'), 'first_name'));
    }

    public function test_conversation_decline_and_refer(): void
    {
        $this->ask($this->brother, ['target_shaykh_id' => $this->shaykh->id]);
        $thread = FatwaThread::sole();

        $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/messages", ['body' => 'Which madhab do you follow?'])->assertOk();
        $this->as($this->brother)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/messages", ['body' => 'Maliki'])
            ->assertOk()
            ->assertJsonCount(2, 'thread.messages')
            ->assertJsonPath('thread.messages.1.from', 'asker');

        // Not a party: not found. A brother's question can't go to a female shaykh.
        $this->as($this->sister)->getJson("/api/v1/community/fatwa-threads/{$thread->id}")->assertNotFound();
        $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/refer", ['shaykh_id' => $this->shaykha->id])->assertUnprocessable();

        $other = $this->makeShaykh('male', 'Other');
        $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/refer", ['shaykh_id' => $other->id])->assertOk();
        $this->assertSame('referred', $thread->fresh()->status);
        $this->as($other->profile)->getJson('/api/v1/community/fatwa/inbox')->assertJsonCount(1, 'threads');

        $this->as($this->brother)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/messages", ['body' => 'Hello?'])->assertStatus(409);
    }

    public function test_a_fatwa_is_published_only_when_both_agree(): void
    {
        $this->ask($this->sister, ['target_shaykh_id' => $this->shaykha->id, 'show_asker_gender' => true]);
        $thread = FatwaThread::sole();

        $this->as($this->shaykha->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/publish-proposal", ['question_text' => 'Q', 'answer_text' => 'A'])
            ->assertStatus(409);
        $this->as($this->shaykha->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/messages", ['body' => 'The answer', 'answered' => true])->assertOk();
        $publicationId = $this->as($this->shaykha->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/publish-proposal", [
            'question_text' => 'Rewritten question', 'answer_text' => 'Rewritten answer',
        ])->assertOk()->json('publication.id');

        $this->as($this->sister)->getJson('/api/v1/community/fatwas')->assertJsonCount(0, 'fatwas');
        $this->as($this->brother)->postJson("/api/v1/community/fatwa-publications/{$publicationId}/approve")->assertNotFound();

        $this->as($this->sister)->postJson("/api/v1/community/fatwa-publications/{$publicationId}/approve")->assertOk();
        $this->as($this->sister)->getJson('/api/v1/community/fatwas')
            ->assertJsonPath('fatwas.0.question', 'Rewritten question')
            ->assertJsonPath('fatwas.0.asker_gender', 'female')
            ->assertJsonPath('fatwas.0.shaykh.manhaj', 'Manhaj of Aisha');

        // A female shaykh's fatwa is for women only.
        $this->as($this->brother)->getJson('/api/v1/community/fatwas')->assertJsonCount(0, 'fatwas');
    }

    public function test_the_asker_can_refuse_the_proposed_text(): void
    {
        $this->ask($this->brother, ['target_shaykh_id' => $this->shaykh->id]);
        $thread = FatwaThread::sole();
        $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/messages", ['body' => 'Answer']);
        $id = $this->as($this->shaykh->profile)->postJson("/api/v1/community/fatwa-threads/{$thread->id}/publish-proposal", ['question_text' => 'Q', 'answer_text' => 'A'])->json('publication.id');

        $this->as($this->brother)->postJson("/api/v1/community/fatwa-publications/{$id}/refuse")->assertOk();
        $this->assertSame(0, FatwaPublication::count());
    }

    public function test_only_admins_see_the_asker_and_only_from_a_shaykh_s_report(): void
    {
        $questionId = $this->ask($this->brother, ['target_shaykh_id' => $this->shaykh->id])->json('question.id');

        $this->as($this->sister)->postJson('/api/v1/community/reports', ['target_type' => 'fatwa_question', 'target_id' => $questionId, 'reason' => 'abuse'])
            ->assertNotFound();
        $this->as($this->shaykh->profile)->postJson('/api/v1/community/reports', ['target_type' => 'fatwa_question', 'target_id' => $questionId, 'reason' => 'abuse'])
            ->assertCreated();

        $admin = $this->adminHeaders($this->createAdmin());
        $this->forgetAuth();
        $this->withHeaders($admin)->getJson('/api/v1/admin/community/reports')
            ->assertJsonPath('items.0.target.author.first_name', 'Asker');
    }

    /** @param  array<string, mixed>  $body */
    private function ask(CommunityProfile $asker, array $body): TestResponse
    {
        return $this->as($asker)->postJson('/api/v1/community/fatwa-questions', [
            'body' => 'Is this permissible in my situation?',
            'show_asker_gender' => false,
            ...$body,
        ]);
    }

    private function as(CommunityProfile $profile): static
    {
        $this->forgetAuth();

        return $this->actingAs(User::find($profile->user_id));
    }

    private function makeShaykh(string $gender, string $name): Shaykh
    {
        return Shaykh::create([
            'profile_id' => $this->profile($gender, $name)->id,
            'manhaj' => "Manhaj of {$name}",
            'marja' => "Marja of {$name}",
            'trusted_at' => now(),
        ])->load('profile');
    }

    private function profile(string $gender, string $name): CommunityProfile
    {
        return CommunityProfile::create([
            'user_id' => User::factory()->create()->id,
            'first_name' => $name,
            'last_name' => 'Member',
            'gender' => $gender,
            'status' => 'active',
            'joined_at' => now(),
        ]);
    }
}
