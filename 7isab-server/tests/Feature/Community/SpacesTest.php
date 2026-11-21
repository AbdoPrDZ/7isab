<?php

namespace Tests\Feature\Community;

use App\Models\User;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use App\Modules\Community\Models\SpaceRequest;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SpacesTest extends TestCase
{
    private CommunityProfile $brother;

    private CommunityProfile $sister;

    protected function setUp(): void
    {
        parent::setUp();

        $this->brother = $this->profile('male');
        $this->sister = $this->profile('female');
    }

    public function test_discovery_never_shows_the_other_gender_even_when_searching(): void
    {
        $this->space($this->sister, ['name' => 'Sisters Quran circle']);
        $this->space($this->brother, ['name' => 'Brothers Quran circle']);
        $this->space($this->sister, ['type' => 'page', 'gender' => null, 'name' => 'Quran page for all']);

        $names = fn (TestResponse $response) => array_column($response->json('spaces'), 'name');

        $this->assertEqualsCanonicalizing(
            ['Brothers Quran circle', 'Quran page for all'],
            $names($this->as($this->brother)->getJson('/api/v1/community/spaces?search=quran')->assertOk()),
        );
        $this->assertSame(['Quran page for all'], $names($this->as($this->brother)->getJson('/api/v1/community/spaces?type=page')));
    }

    public function test_the_other_gender_s_group_is_hidden_everywhere(): void
    {
        $group = $this->space($this->sister);

        $this->as($this->brother)->getJson("/api/v1/community/spaces/{$group->slug}")->assertNotFound();
        $this->as($this->brother)->postJson("/api/v1/community/spaces/{$group->id}/join")->assertNotFound();
        $this->as($this->brother)->getJson("/api/v1/community/spaces/{$group->id}/posts")->assertNotFound();
        $this->as($this->brother)->postJson("/api/v1/community/spaces/{$group->id}/posts", ['type' => 'text', 'body' => 'Hi'])->assertNotFound();
    }

    public function test_a_page_for_one_gender_cannot_be_followed_by_the_other(): void
    {
        $page = $this->space($this->sister, ['type' => 'page', 'gender' => 'female']);

        $this->as($this->brother)->postJson("/api/v1/community/spaces/{$page->id}/follow")->assertNotFound();
        $this->as($this->profile('female'))->postJson("/api/v1/community/spaces/{$page->id}/follow")->assertCreated();
    }

    public function test_joining_open_and_approval_groups(): void
    {
        $open = $this->space($this->brother);
        $closed = $this->space($this->brother, ['join_policy' => 'approval']);
        $other = $this->profile('male');

        $this->as($other)->postJson("/api/v1/community/spaces/{$open->id}/join")->assertCreated()->assertJsonPath('space.my_status', 'active');
        $this->as($other)->postJson("/api/v1/community/spaces/{$closed->id}/join")->assertCreated()->assertJsonPath('space.my_status', 'pending');
        $this->as($other)->postJson("/api/v1/community/spaces/{$open->id}/join")->assertStatus(409);
    }

    public function test_pages_are_followed_and_groups_joined(): void
    {
        $group = $this->space($this->brother);
        $page = $this->space($this->brother, ['type' => 'page', 'gender' => null]);

        $this->as($this->sister)->postJson("/api/v1/community/spaces/{$page->id}/join")->assertUnprocessable();
        $this->as($this->sister)->postJson("/api/v1/community/spaces/{$page->id}/follow")->assertCreated()->assertJsonPath('space.my_role', 'follower');
        $this->as($this->sister)->postJson("/api/v1/community/spaces/{$page->id}/unfollow")->assertOk();
        $this->as($this->profile('male'))->postJson("/api/v1/community/spaces/{$group->id}/follow")->assertUnprocessable();
    }

    public function test_only_people_in_a_space_read_its_content(): void
    {
        $group = $this->space($this->brother);
        $page = $this->space($this->brother, ['type' => 'page', 'gender' => null]);
        $groupPost = Post::create(['space_id' => $group->id, 'author_id' => $this->brother->id, 'type' => 'text', 'body' => 'Group only', 'audience' => 'everyone', 'status' => 'published']);
        $pagePost = Post::create(['space_id' => $page->id, 'author_id' => $this->brother->id, 'type' => 'text', 'body' => 'Followers only', 'audience' => 'everyone', 'status' => 'published']);
        $outsider = $this->profile('male');

        // The description stays visible so people can decide to join; the content doesn't.
        $this->as($outsider)->getJson("/api/v1/community/spaces/{$group->slug}")->assertOk()->assertJsonPath('space.can_post', false);
        $this->as($outsider)->getJson("/api/v1/community/spaces/{$group->id}/posts")->assertForbidden()->assertJsonPath('reason', 'not_in_space');
        foreach ([$groupPost, $pagePost] as $post) {
            $this->as($outsider)->getJson("/api/v1/community/posts/{$post->id}")->assertNotFound();
            $this->as($outsider)->getJson("/api/v1/community/posts/{$post->id}/comments")->assertNotFound();
            $this->as($outsider)->postJson("/api/v1/community/posts/{$post->id}/comments", ['body' => 'Hi'])->assertNotFound();
            $this->as($outsider)->postJson("/api/v1/community/posts/{$post->id}/save")->assertNotFound();
            $this->as($outsider)->postJson('/api/v1/community/reports', ['target_type' => 'post', 'target_id' => $post->id, 'reason' => 'other'])->assertNotFound();
        }
        $this->as($outsider)->postJson("/api/v1/community/spaces/{$page->id}/posts", ['type' => 'text', 'body' => 'Hi'])->assertForbidden();

        // A pending join request doesn't open the group either.
        $group->update(['join_policy' => 'approval']);
        $this->as($outsider)->postJson("/api/v1/community/spaces/{$group->id}/join")->assertCreated();
        $this->as($outsider)->getJson("/api/v1/community/posts/{$groupPost->id}")->assertNotFound();

        // Following the page opens it.
        $this->as($outsider)->postJson("/api/v1/community/spaces/{$page->id}/follow")->assertCreated();
        $this->as($outsider)->getJson("/api/v1/community/posts/{$pagePost->id}")->assertOk();
        $this->as($outsider)->getJson("/api/v1/community/spaces/{$page->id}/posts")->assertOk()->assertJsonPath('posts.0.id', $pagePost->id);
    }

    public function test_the_owner_cannot_leave(): void
    {
        $group = $this->space($this->brother);

        $this->as($this->brother)->postJson("/api/v1/community/spaces/{$group->id}/leave")->assertForbidden();
    }

    public function test_moderation_of_join_requests_and_removal(): void
    {
        $group = $this->space($this->brother, ['join_policy' => 'approval']);
        $applicant = $this->profile('male');
        $stranger = $this->profile('male');

        $this->as($applicant)->postJson("/api/v1/community/spaces/{$group->id}/join")->assertCreated();
        $member = SpaceMember::where('profile_id', $applicant->id)->sole();

        $this->as($stranger)->getJson("/api/v1/community/spaces/{$group->id}/members?status=pending")->assertForbidden();
        $this->as($this->brother)->getJson("/api/v1/community/spaces/{$group->id}/members?status=pending")
            ->assertOk()
            ->assertJsonPath('members.0.profile.id', $applicant->id);

        $this->as($this->brother)->postJson("/api/v1/community/spaces/{$group->id}/members/{$member->id}/approve")->assertOk();
        $this->as($this->brother)->postJson("/api/v1/community/spaces/{$group->id}/members/{$member->id}/ban")->assertOk();

        $this->as($applicant)->postJson("/api/v1/community/spaces/{$group->id}/posts", ['type' => 'text', 'body' => 'Hi'])->assertForbidden();
        $this->as($applicant)->postJson("/api/v1/community/spaces/{$group->id}/leave")->assertNotFound();
        $this->as($applicant)->postJson("/api/v1/community/spaces/{$group->id}/join")->assertForbidden()->assertJsonPath('reason', 'banned');
    }

    public function test_moderators_are_of_the_owner_s_gender_and_appointed_by_the_owner(): void
    {
        $page = $this->space($this->brother, ['type' => 'page', 'gender' => null]);
        $brotherFollower = $this->member($page, $this->profile('male'), 'follower');
        $sisterFollower = $this->member($page, $this->sister, 'follower');

        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$page->id}/members/{$sisterFollower->id}/role", ['role' => 'moderator'])
            ->assertUnprocessable();
        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$page->id}/members/{$brotherFollower->id}/role", ['role' => 'moderator'])
            ->assertOk()
            ->assertJsonPath('member.role', 'moderator');

        $this->as($brotherFollower->profile)->putJson("/api/v1/community/spaces/{$page->id}/members/{$brotherFollower->id}/role", ['role' => 'member'])
            ->assertForbidden();
        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$page->id}/members/{$brotherFollower->id}/role", ['role' => 'member'])
            ->assertJsonPath('member.role', 'follower');
    }

    public function test_page_posting_settings_are_enforced(): void
    {
        $page = $this->space($this->brother, ['type' => 'page', 'gender' => null]);
        $post = fn (CommunityProfile $profile) => $this->as($profile)->postJson("/api/v1/community/spaces/{$page->id}/posts", ['type' => 'text', 'body' => 'Benefit']);
        // Posting is for followers: only they read the page.
        $this->member($page, $this->sister, 'follower');
        $this->member($page, $brotherFollower = $this->profile('male'), 'follower');

        // Anyone who can see the page posts by default.
        $post($this->sister)->assertCreated()->assertJsonPath('post.status', 'published');

        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$page->id}/settings", [
            'posting_public' => true, 'posting_gender' => 'male', 'posting_requires_approval' => true,
        ])->assertOk()->assertJsonPath('space.posting_gender', 'male');

        $post($this->sister)->assertForbidden();
        $post($brotherFollower)->assertCreated()->assertJsonPath('post.status', 'pending');
        $post($this->brother)->assertCreated()->assertJsonPath('post.status', 'published');

        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$page->id}/settings", [
            'posting_public' => false, 'posting_gender' => 'any', 'posting_requires_approval' => false,
        ])->assertOk();
        $post($brotherFollower)->assertForbidden();
        $post($this->profile('male'))->assertForbidden();
    }

    public function test_a_one_gender_page_cannot_be_limited_to_the_other_gender(): void
    {
        $page = $this->space($this->brother, ['type' => 'page', 'gender' => 'male']);

        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$page->id}/settings", [
            'posting_public' => true, 'posting_gender' => 'female', 'posting_requires_approval' => false,
        ])->assertUnprocessable();
    }

    public function test_only_the_owner_changes_settings(): void
    {
        $group = $this->space($this->brother);
        $this->member($group, $moderator = $this->profile('male'), 'moderator');

        $this->as($moderator)->putJson("/api/v1/community/spaces/{$group->id}/settings", ['join_policy' => 'approval'])->assertForbidden();
        $this->as($this->brother)->putJson("/api/v1/community/spaces/{$group->id}/settings", ['join_policy' => 'approval'])
            ->assertOk()
            ->assertJsonPath('space.join_policy', 'approval');
    }

    public function test_creation_request_review_and_resubmission(): void
    {
        $this->as($this->sister)->postJson('/api/v1/community/space-requests', $this->requestBody(['join_policy' => null]))
            ->assertUnprocessable();

        $id = $this->as($this->sister)->postJson('/api/v1/community/space-requests', $this->requestBody())
            ->assertCreated()
            ->json('request.id');

        $admin = $this->adminHeaders($this->createAdmin());
        $this->forgetAuth();
        $this->withHeaders($admin)->postJson("/api/v1/admin/community/space-requests/{$id}/request-changes", ['note' => 'Clarify the goals'])->assertOk();

        $this->forgetAuth();
        $this->as($this->sister)->putJson("/api/v1/community/space-requests/{$id}", $this->requestBody(['goals' => 'Clearer goals']))
            ->assertOk()
            ->assertJsonPath('request.status', 'pending');

        $this->forgetAuth();
        $this->withHeaders($admin)->postJson("/api/v1/admin/community/space-requests/{$id}/approve")->assertCreated();

        $space = Space::where('name', 'Hifz circle')->sole();
        $this->assertSame('female', $space->gender);
        $this->assertSame($this->sister->id, $space->owner_id);
        $this->assertDatabaseHas('space_members', ['space_id' => $space->id, 'profile_id' => $this->sister->id, 'role' => 'owner']);
        $this->assertSame('approved', SpaceRequest::find($id)->status);
    }

    public function test_an_approved_page_for_everyone_has_no_gender(): void
    {
        $spaceRequest = SpaceRequest::create([...$this->requestBody(['type' => 'page', 'join_policy' => null, 'audience' => 'everyone']), 'requester_id' => $this->sister->id, 'status' => 'pending']);

        $this->withHeaders($this->adminHeaders($this->createAdmin()))->postJson("/api/v1/admin/community/space-requests/{$spaceRequest->id}/approve")
            ->assertCreated()
            ->assertJsonPath('item.gender', null);
    }

    public function test_admin_transfers_only_to_the_same_gender_and_closes_spaces(): void
    {
        $group = $this->space($this->brother);
        $admin = $this->adminHeaders($this->createAdmin());

        $this->withHeaders($admin)->postJson("/api/v1/admin/community/spaces/{$group->id}/transfer", ['profile_id' => $this->sister->id])
            ->assertUnprocessable();

        $newOwner = $this->profile('male');
        $this->forgetAuth();
        $this->withHeaders($admin)->postJson("/api/v1/admin/community/spaces/{$group->id}/transfer", ['profile_id' => $newOwner->id])->assertOk();
        $this->assertDatabaseHas('space_members', ['space_id' => $group->id, 'profile_id' => $this->brother->id, 'role' => 'moderator']);
        $this->assertDatabaseHas('space_members', ['space_id' => $group->id, 'profile_id' => $newOwner->id, 'role' => 'owner']);

        $this->forgetAuth();
        $this->withHeaders($admin)->postJson("/api/v1/admin/community/spaces/{$group->id}/close")->assertOk();
        $this->forgetAuth();
        $this->as($this->brother)->getJson("/api/v1/community/spaces/{$group->slug}")->assertNotFound();
        $this->assertSame(0, Post::count());
    }

    private function as(CommunityProfile $profile): static
    {
        $this->forgetAuth();

        return $this->actingAs($profile->user()->first());
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

    /** @param  array<string, mixed>  $attributes */
    private function space(CommunityProfile $owner, array $attributes = []): Space
    {
        static $count = 0;
        $count++;

        $space = Space::create([
            'type' => 'group',
            'name' => "Space {$count}",
            'slug' => "space-{$count}",
            'purpose' => 'Purpose',
            'goals' => 'Goals',
            'content_plan' => 'Plan',
            'owner_id' => $owner->id,
            'gender' => $owner->gender,
            'join_policy' => 'open',
            'posting_public' => true,
            'posting_gender' => 'any',
            'posting_requires_approval' => false,
            'status' => 'active',
            ...$attributes,
        ]);

        $this->member($space, $owner, 'owner');

        return $space;
    }

    private function member(Space $space, CommunityProfile $profile, string $role): SpaceMember
    {
        return SpaceMember::create(['space_id' => $space->id, 'profile_id' => $profile->id, 'role' => $role, 'status' => 'active']);
    }

    /** @param  array<string, mixed>  $overrides */
    private function requestBody(array $overrides = []): array
    {
        return [
            'type' => 'group',
            'name' => 'Hifz circle',
            'purpose' => 'Memorise together',
            'goals' => 'One page a day',
            'content_plan' => 'Daily reminders',
            'join_policy' => 'approval',
            ...$overrides,
        ];
    }
}
