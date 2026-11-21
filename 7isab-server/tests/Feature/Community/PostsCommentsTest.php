<?php

namespace Tests\Feature\Community;

use App\Models\User;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\Report;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class PostsCommentsTest extends TestCase
{
    private CommunityProfile $brother;

    private CommunityProfile $sister;

    /** A page open to everyone, owned by the brother, followed by the sister. */
    private Space $page;

    protected function setUp(): void
    {
        parent::setUp();

        $this->brother = $this->profile('male');
        $this->sister = $this->profile('female');
        $this->page = Space::create([
            'type' => 'page', 'name' => 'Benefit', 'slug' => 'benefit', 'purpose' => 'P', 'goals' => 'G', 'content_plan' => 'C',
            'owner_id' => $this->brother->id, 'gender' => null, 'join_policy' => 'open', 'posting_public' => true,
            'posting_gender' => 'any', 'posting_requires_approval' => false, 'status' => 'active',
        ]);
        SpaceMember::create(['space_id' => $this->page->id, 'profile_id' => $this->brother->id, 'role' => 'owner', 'status' => 'active']);
        SpaceMember::create(['space_id' => $this->page->id, 'profile_id' => $this->sister->id, 'role' => 'follower', 'status' => 'active']);
    }

    public function test_an_ayah_card_always_carries_the_server_s_quran_text(): void
    {
        $this->seedQuran();

        $id = $this->createPost($this->brother, ['type' => 'ayah', 'payload' => ['surah' => 1, 'from' => 1, 'to' => 2, 'text' => 'forged']])
            ->assertCreated()
            ->json('post.id');

        $payload = Post::find($id)->payload;
        $this->assertSame(['Ayah 1:1', 'Ayah 1:2'], array_column($payload['ayat'], 'text'));
        $this->assertArrayNotHasKey('text', $payload);

        $this->createPost($this->brother, ['type' => 'ayah', 'payload' => ['surah' => 1, 'from' => 6, 'to' => 8]])->assertUnprocessable();
    }

    public function test_an_event_is_stored_in_utc_and_must_be_in_the_future(): void
    {
        $this->createPost($this->brother, ['type' => 'event', 'payload' => ['title' => 'Halaqa', 'starts_at' => now()->subHour()->toIso8601String()]])
            ->assertUnprocessable();
        $this->createPost($this->brother, ['type' => 'event', 'payload' => ['title' => 'Halaqa', 'starts_at' => now()->addDay()->toIso8601String(), 'link' => 'http://insecure.example']])
            ->assertUnprocessable();

        $id = $this->createPost($this->brother, ['type' => 'event', 'body' => 'Join us', 'payload' => [
            'title' => ' Tafsir lesson ',
            'starts_at' => '2099-03-01T19:30:00+01:00',
            'place' => 'Main mosque',
            'link' => 'https://example.com/live',
            'extra' => 'dropped',
        ]])->assertCreated()->json('post.id');

        $this->assertSame([
            'title' => 'Tafsir lesson',
            'starts_at' => '2099-03-01T18:30:00Z',
            'ends_at' => null,
            'place' => 'Main mosque',
            'link' => 'https://example.com/live',
            'details' => null,
        ], Post::find($id)->payload);
    }

    public function test_upcoming_events_are_listed_soonest_first(): void
    {
        $event = fn (string $title, string $startsAt) => Post::create([
            'space_id' => $this->page->id, 'author_id' => $this->brother->id, 'type' => 'event', 'body' => '',
            'payload' => ['title' => $title, 'starts_at' => $startsAt], 'audience' => 'everyone', 'status' => 'published',
        ]);
        $event('Later', now()->addDays(5)->utc()->toIso8601ZuluString());
        $event('Past', now()->subDay()->utc()->toIso8601ZuluString());
        $event('Soon', now()->addDay()->utc()->toIso8601ZuluString());

        $titles = array_column(array_column($this->as($this->sister)->getJson('/api/v1/community/events')->assertOk()->json('posts'), 'payload'), 'title');
        $this->assertSame(['Soon', 'Later'], $titles);
    }

    public function test_a_hadith_needs_its_book_and_number(): void
    {
        $this->createPost($this->brother, ['type' => 'hadith', 'payload' => ['text' => 'Actions are by intentions']])
            ->assertUnprocessable()
            ->assertJsonStructure(['errors' => ['payload.book', 'payload.number']]);

        $this->createPost($this->brother, ['type' => 'hadith', 'payload' => ['text' => 'Actions are by intentions', 'book' => 'Bukhari', 'number' => '1']])
            ->assertCreated();
    }

    public function test_a_text_post_for_one_gender_is_hidden_from_the_other(): void
    {
        $this->createPost($this->sister, ['type' => 'text', 'body' => 'For sisters', 'audience' => 'own_gender'])->assertCreated();
        $this->createPost($this->sister, ['type' => 'text', 'body' => 'For all'])->assertCreated();

        $bodies = array_column($this->as($this->brother)->getJson("/api/v1/community/spaces/{$this->page->id}/posts")->json('posts'), 'body');
        $this->assertSame(['For all'], $bodies);
    }

    public function test_comments_are_separated_by_gender(): void
    {
        $post = $this->textPost($this->brother);

        $sisterComment = $this->as($this->sister)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Sister comment'])
            ->assertCreated()
            ->json('comment.id');
        $this->as($this->brother)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Brother comment'])->assertCreated();

        $this->assertSame(['Brother comment'], array_column($this->as($this->brother)->getJson("/api/v1/community/posts/{$post->id}/comments")->json('comments'), 'body'));
        $this->assertSame(['Sister comment'], array_column($this->as($this->sister)->getJson("/api/v1/community/posts/{$post->id}/comments")->json('comments'), 'body'));

        // No reply across genders, no editing or removing the other gender's comments.
        $this->as($this->brother)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Reply', 'parent_id' => $sisterComment])
            ->assertUnprocessable();
        $this->as($this->brother)->deleteJson("/api/v1/community/comments/{$sisterComment}")->assertNotFound();

        $this->assertSame(1, $this->as($this->brother)->getJson("/api/v1/community/posts/{$post->id}")->json('post.comments_count'));
    }

    public function test_replies_form_a_tree_and_survive_a_deleted_parent(): void
    {
        $post = $this->textPost($this->brother);
        $other = $this->profile('male');
        $this->follow($other);

        $parent = $this->as($other)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Question'])->json('comment.id');
        $this->as($this->brother)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Answer', 'parent_id' => $parent])
            ->assertCreated()
            ->assertJsonPath('comment.parent_id', $parent);

        $this->as($other)->putJson("/api/v1/community/comments/{$parent}", ['body' => 'Better question'])->assertOk()->assertJsonPath('comment.body', 'Better question');
        $this->as($other)->deleteJson("/api/v1/community/comments/{$parent}")->assertOk();

        $comments = $this->as($this->brother)->getJson("/api/v1/community/posts/{$post->id}/comments")->json('comments');
        $this->assertTrue($comments[0]['deleted']);
        $this->assertNull($comments[0]['body']);
        $this->assertSame('Answer', $comments[1]['body']);
    }

    public function test_a_member_who_left_shows_as_deleted_by_author(): void
    {
        $this->textPost($this->sister, 'Old post');
        $this->sister->update(['status' => 'left']);

        $post = $this->as($this->brother)->getJson("/api/v1/community/spaces/{$this->page->id}/posts")->json('posts.0');
        $this->assertTrue($post['deleted_by_author']);
        $this->assertNull($post['body']);
        $this->assertNull($post['author']);
    }

    public function test_mutes_hide_one_way_and_blocks_both_ways(): void
    {
        $this->textPost($this->sister, 'Sister post');
        $this->textPost($this->brother, 'Brother post');
        $bodies = fn (CommunityProfile $viewer) => array_column($this->as($viewer)->getJson('/api/v1/community/feed')->json('posts'), 'body');

        $this->as($this->brother)->postJson('/api/v1/community/mutes', ['target_id' => $this->sister->id])->assertCreated();
        $this->assertSame(['Brother post'], $bodies($this->brother));
        $this->assertContains('Brother post', $bodies($this->sister));

        $this->as($this->brother)->deleteJson("/api/v1/community/mutes/{$this->sister->id}")->assertOk();
        $this->as($this->brother)->postJson('/api/v1/community/blocks', ['target_id' => $this->sister->id])->assertCreated();
        $this->assertSame(['Sister post'], $bodies($this->sister));
        $this->assertSame([['id' => $this->sister->id, 'first_name' => 'Female', 'last_name' => 'Member']], $this->as($this->brother)->getJson('/api/v1/community/blocks')->json('items'));

        $this->as($this->brother)->postJson('/api/v1/community/blocks', ['target_id' => $this->brother->id])->assertUnprocessable();
    }

    public function test_approval_queue_for_the_owner_and_moderators(): void
    {
        $this->page->update(['posting_requires_approval' => true]);

        $id = $this->createPost($this->sister, ['type' => 'text', 'body' => 'Waiting'])->assertJsonPath('post.status', 'pending')->json('post.id');

        // The author sees their own pending post; others don't.
        $this->assertSame([$id], array_column($this->as($this->sister)->getJson("/api/v1/community/spaces/{$this->page->id}/posts")->json('posts'), 'id'));
        $follower = $this->profile('male');
        $this->follow($follower);
        $this->assertSame([], $this->as($follower)->getJson("/api/v1/community/spaces/{$this->page->id}/posts")->json('posts'));

        $this->as($this->sister)->getJson("/api/v1/community/spaces/{$this->page->id}/pending-posts")->assertForbidden();
        $this->assertSame([$id], array_column($this->as($this->brother)->getJson("/api/v1/community/spaces/{$this->page->id}/pending-posts")->json('posts'), 'id'));

        $this->as($this->sister)->postJson("/api/v1/community/posts/{$id}/approve")->assertForbidden();
        $this->as($this->brother)->postJson("/api/v1/community/posts/{$id}/approve")->assertOk();
        $this->assertSame('published', Post::find($id)->status);
    }

    public function test_the_owner_s_queue_skips_posts_for_the_other_gender_only(): void
    {
        $this->page->update(['posting_requires_approval' => true]);
        $this->createPost($this->sister, ['type' => 'text', 'body' => 'Sisters only', 'audience' => 'own_gender'])->assertCreated();

        $this->assertSame([], $this->as($this->brother)->getJson("/api/v1/community/spaces/{$this->page->id}/pending-posts")->json('posts'));
    }

    public function test_editing_deleting_and_moderator_hiding(): void
    {
        $mine = $this->textPost($this->sister, 'Draft');

        $this->as($this->brother)->putJson("/api/v1/community/posts/{$mine->id}", ['body' => 'Changed'])->assertNotFound();
        $this->as($this->sister)->putJson("/api/v1/community/posts/{$mine->id}", ['body' => 'Final'])
            ->assertOk()
            ->assertJsonPath('post.body', 'Final');
        $this->assertNotNull($mine->fresh()->edited_at);

        // The page's owner hides it; the author deletes their own.
        $this->as($this->brother)->deleteJson("/api/v1/community/posts/{$mine->id}")->assertOk();
        $this->assertSame('hidden', $mine->fresh()->status);

        $other = $this->textPost($this->sister, 'Second');
        $this->as($this->sister)->deleteJson("/api/v1/community/posts/{$other->id}")->assertOk();
        $this->assertModelMissing($other);
    }

    public function test_saving_posts(): void
    {
        $post = $this->textPost($this->brother);

        $this->as($this->sister)->postJson("/api/v1/community/posts/{$post->id}/save")->assertOk();
        $this->as($this->sister)->postJson("/api/v1/community/posts/{$post->id}/save")->assertOk();
        $this->assertTrue($this->as($this->sister)->getJson("/api/v1/community/posts/{$post->id}")->json('post.saved'));
        $this->assertSame([$post->id], array_column($this->as($this->sister)->getJson('/api/v1/community/saved-posts')->json('posts'), 'id'));

        $this->as($this->sister)->deleteJson("/api/v1/community/posts/{$post->id}/save")->assertOk();
        $this->assertSame([], $this->as($this->sister)->getJson('/api/v1/community/saved-posts')->json('posts'));
    }

    public function test_reports_only_reach_what_the_reporter_can_see_and_admins_act_on_them(): void
    {
        $sisterPost = $this->textPost($this->sister, 'Sisters only', 'own_gender');
        $post = $this->textPost($this->sister, 'Selling things');

        $this->as($this->brother)->postJson('/api/v1/community/reports', ['target_type' => 'post', 'target_id' => $sisterPost->id, 'reason' => 'ads'])
            ->assertNotFound();
        $this->as($this->brother)->postJson('/api/v1/community/reports', ['target_type' => 'post', 'target_id' => $post->id, 'reason' => 'ads'])
            ->assertCreated();
        $this->follow($secondReporter = $this->profile('male'));
        $this->as($secondReporter)->postJson('/api/v1/community/reports', ['target_type' => 'post', 'target_id' => $post->id, 'reason' => 'ads'])->assertCreated();

        $admin = $this->adminHeaders($this->createAdmin());
        $this->forgetAuth();
        $queue = $this->withHeaders($admin)->getJson('/api/v1/admin/community/reports')->assertOk();
        $this->assertSame('Selling things', $queue->json('items.0.target.body'));
        $this->assertSame(2, $queue->json('items.0.same_target_count'));

        $this->forgetAuth();
        $this->withHeaders($admin)->postJson('/api/v1/admin/community/reports/'.$queue->json('items.0.id').'/ban')->assertOk();
        $this->assertSame('banned', $this->sister->fresh()->status);
        $this->assertSame(0, Report::where('status', 'pending')->count());
    }

    public function test_admin_hides_a_reported_comment(): void
    {
        $post = $this->textPost($this->brother);
        $comment = Comment::create(['post_id' => $post->id, 'author_id' => $this->sister->id, 'author_gender' => 'female', 'body' => 'Bad', 'status' => 'published']);
        $report = Report::create(['reporter_id' => $this->brother->id, 'target_type' => 'comment', 'target_id' => $comment->id, 'reason' => 'abuse', 'status' => 'pending']);

        $this->withHeaders($this->adminHeaders($this->createAdmin()))->postJson("/api/v1/admin/community/reports/{$report->id}/hide")->assertOk();
        $this->assertSame('hidden', $comment->fresh()->status);
    }

    private function as(CommunityProfile $profile): static
    {
        $this->forgetAuth();

        return $this->actingAs(User::find($profile->user_id));
    }

    /** @param  array<string, mixed>  $body */
    private function createPost(CommunityProfile $author, array $body): TestResponse
    {
        return $this->as($author)->postJson("/api/v1/community/spaces/{$this->page->id}/posts", $body);
    }

    private function textPost(CommunityProfile $author, string $body = 'Benefit', string $audience = 'everyone'): Post
    {
        return Post::create([
            'space_id' => $this->page->id, 'author_id' => $author->id, 'type' => 'text', 'body' => $body,
            'audience' => $audience, 'status' => 'published',
        ]);
    }

    private function follow(CommunityProfile $profile): void
    {
        SpaceMember::create(['space_id' => $this->page->id, 'profile_id' => $profile->id, 'role' => 'follower', 'status' => 'active']);
    }

    private function profile(string $gender): CommunityProfile
    {
        return CommunityProfile::create([
            'user_id' => User::factory()->create()->id,
            'first_name' => ucfirst($gender),
            'last_name' => 'Member',
            'gender' => $gender,
            'status' => 'active',
            'joined_at' => now(),
        ]);
    }

    /** Al-Fatiha with placeholder text: enough for ayah cards. */
    private function seedQuran(): void
    {
        DB::table('quran_surahs')->insert([
            'id' => 1, 'name_arabic' => 'الفاتحة', 'name_simple' => 'Al-Fatihah', 'name_english' => 'The Opener', 'revelation_place' => 'makkah',
            'revelation_order' => 5, 'verses_count' => 7, 'page_start' => 1, 'page_end' => 1, 'bismillah_pre' => false,
        ]);
        foreach (range(1, 7) as $number) {
            DB::table('quran_ayahs')->insert([
                'id' => $number, 'surah_id' => 1, 'number' => $number, 'key' => "1:{$number}", 'page' => 1, 'juz' => 1,
                'hizb' => 1, 'rub_el_hizb' => 1, 'sajdah' => false, 'text' => "Ayah 1:{$number}",
            ]);
        }
    }
}
