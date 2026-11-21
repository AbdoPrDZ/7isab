<?php

namespace Tests\Feature\Community;

use App\Models\User;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\Post;
use App\Modules\Community\Models\ProgramTemplate;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceMember;
use App\Modules\Community\Models\TestamentTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private CommunityProfile $profile;

    private Space $space;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->profile = CommunityProfile::create([
            'user_id' => $this->user->id,
            'first_name' => 'Test',
            'last_name' => 'User',
            'gender' => 'male',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->space = Space::create([
            'type' => 'group',
            'name' => 'Test Group',
            'slug' => 'test-group',
            'purpose' => 'Testing',
            'goals' => 'Test goals',
            'content_plan' => 'Test plan',
            'owner_id' => $this->profile->id,
            'gender' => 'male',
            'join_policy' => 'open',
            'status' => 'active',
        ]);

        SpaceMember::create([
            'space_id' => $this->space->id,
            'profile_id' => $this->profile->id,
            'role' => 'member',
            'status' => 'active',
        ]);
    }

    public function test_can_create_testament_post(): void
    {
        $payload = [
            'category' => 'akhira',
            'text' => 'Test testament text',
            'source' => 'Test source',
        ];

        $response = $this->actingAs($this->user)->postJson("/api/v1/community/spaces/{$this->space->id}/posts", [
            'type' => 'testament',
            'body' => 'Sharing a testament',
            'payload' => $payload,
        ]);

        $response->assertCreated();
        $response->assertJson(['post' => ['status' => 'published']]);

        $post = Post::where('type', 'testament')->first();
        $this->assertNotNull($post);
        $this->assertEquals('testament', $post->type);
        $this->assertNotNull($post->payload['template_id']);

        $template = TestamentTemplate::find($post->payload['template_id']);
        $this->assertNotNull($template);
        $this->assertEquals('akhira', $template->category);
        $this->assertEquals('Test testament text', $template->text);
        $this->assertEquals('Test source', $template->source);
    }

    public function test_can_create_program_post(): void
    {
        $payload = [
            'name' => 'Test Program',
            'category' => 'improving',
            'goal' => 'Improve yourself',
            'length' => 30,
            'tasks' => [
                ['name' => 'Task 1', 'type' => 'daily', 'reward' => 1],
                ['name' => 'Task 2', 'type' => 'weekly', 'reward' => 2],
            ],
        ];

        $response = $this->actingAs($this->user)->postJson("/api/v1/community/spaces/{$this->space->id}/posts", [
            'type' => 'program',
            'body' => 'Sharing a program',
            'payload' => $payload,
        ]);

        $response->assertCreated();
        $response->assertJson(['post' => ['status' => 'published']]);

        $post = Post::where('type', 'program')->first();
        $this->assertNotNull($post);
        $this->assertEquals('program', $post->type);
        $this->assertNotNull($post->payload['template_id']);

        $template = ProgramTemplate::find($post->payload['template_id']);
        $this->assertNotNull($template);
        $this->assertEquals('Test Program', $template->name);
        $this->assertEquals('improving', $template->category);
        $this->assertEquals('Improve yourself', $template->goal);
        $this->assertEquals(30, $template->length);
        $this->assertCount(2, $template->tasks);
    }

    public function test_cannot_create_testament_without_category(): void
    {
        $payload = [
            'text' => 'Test testament text',
            'source' => 'Test source',
        ];

        $response = $this->actingAs($this->user)->postJson("/api/v1/community/spaces/{$this->space->id}/posts", [
            'type' => 'testament',
            'body' => 'Sharing a testament',
            'payload' => $payload,
        ]);

        $response->assertUnprocessable();
    }

    public function test_cannot_create_program_without_tasks(): void
    {
        $payload = [
            'name' => 'Test Program',
            'category' => 'improving',
            'goal' => 'Improve yourself',
            'length' => 30,
            'tasks' => [],
        ];

        $response = $this->actingAs($this->user)->postJson("/api/v1/community/spaces/{$this->space->id}/posts", [
            'type' => 'program',
            'body' => 'Sharing a program',
            'payload' => $payload,
        ]);

        $response->assertUnprocessable();
    }

    public function test_import_testament_records_import(): void
    {
        $template = TestamentTemplate::create([
            'author_id' => $this->profile->id,
            'category' => 'akhira',
            'text' => 'Test testament text',
            'source' => 'Test source',
        ]);

        $post = Post::create([
            'space_id' => $this->space->id,
            'author_id' => $this->profile->id,
            'type' => 'testament',
            'body' => 'Test',
            'payload' => ['template_id' => $template->id, 'category' => 'akhira', 'text' => 'Test testament text'],
            'audience' => 'everyone',
            'status' => 'published',
        ]);

        $response = $this->actingAs($this->user)->postJson("/api/v1/community/posts/{$post->id}/import");

        $response->assertOk();
        $response->assertJson(['message' => 'Post imported', 'imports_count' => 1]);

        $this->assertDatabaseHas('imports', [
            'profile_id' => $this->profile->id,
            'post_id' => $post->id,
        ]);
    }

    public function test_import_program_records_import(): void
    {
        $template = ProgramTemplate::create([
            'author_id' => $this->profile->id,
            'name' => 'Test Program',
            'category' => 'improving',
            'goal' => 'Improve yourself',
            'length' => 30,
            'tasks' => [['name' => 'Task 1', 'type' => 'daily', 'reward' => 1]],
        ]);

        $post = Post::create([
            'space_id' => $this->space->id,
            'author_id' => $this->profile->id,
            'type' => 'program',
            'body' => 'Test',
            'payload' => [
                'template_id' => $template->id,
                'name' => 'Test Program',
                'category' => 'improving',
                'goal' => 'Improve yourself',
            ],
            'audience' => 'everyone',
            'status' => 'published',
        ]);

        $response = $this->actingAs($this->user)->postJson("/api/v1/community/posts/{$post->id}/import");

        $response->assertOk();
        $response->assertJson(['message' => 'Post imported', 'imports_count' => 1]);

        $this->assertDatabaseHas('imports', [
            'profile_id' => $this->profile->id,
            'post_id' => $post->id,
        ]);
    }

    public function test_importing_twice_counts_once_and_never_copies_the_post(): void
    {
        $post = $this->makeTestamentPost();

        $this->actingAs($this->user)->postJson("/api/v1/community/posts/{$post->id}/import")->assertOk();
        $this->actingAs($this->user)->postJson("/api/v1/community/posts/{$post->id}/import")
            ->assertOk()
            ->assertJson(['imports_count' => 1]);

        $this->assertSame(1, Post::count());
    }

    public function test_cannot_import_a_text_post(): void
    {
        $post = $this->makeTestamentPost(['type' => 'text', 'payload' => null]);

        $this->actingAs($this->user)->postJson("/api/v1/community/posts/{$post->id}/import")->assertNotFound();
        $this->assertDatabaseCount('imports', 0);
    }

    public function test_cannot_import_a_post_from_a_space_of_the_other_gender(): void
    {
        $women = $this->otherGenderSpace();
        $post = $this->makeTestamentPost(['space_id' => $women->id, 'author_id' => $women->owner_id]);

        $this->actingAs($this->user)->postJson("/api/v1/community/posts/{$post->id}/import")->assertNotFound();
    }

    public function test_feed_lists_joined_spaces_and_hides_other_gender_only_posts(): void
    {
        $visible = $this->makeTestamentPost(['body' => 'For everyone']);

        $sister = $this->femaleProfile();
        SpaceMember::create(['space_id' => $this->space->id, 'profile_id' => $sister->id, 'role' => 'member', 'status' => 'active']);
        $this->makeTestamentPost(['body' => 'Sisters only', 'author_id' => $sister->id, 'audience' => 'own_gender']);

        $notJoined = Space::create([...$this->spaceFields(), 'slug' => 'not-joined', 'owner_id' => $this->profile->id]);
        $this->makeTestamentPost(['body' => 'Not joined', 'space_id' => $notJoined->id]);

        $response = $this->actingAs($this->user)->getJson('/api/v1/community/feed');

        $response->assertOk();
        $this->assertSame([$visible->id], array_column($response->json('posts'), 'id'));
        $this->assertSame(['id', 'first_name', 'last_name', 'gender'], array_keys($response->json('posts.0.author')));
    }

    public function test_invalid_program_task_is_rejected_with_a_field_error(): void
    {
        $this->actingAs($this->user)->postJson("/api/v1/community/spaces/{$this->space->id}/posts", [
            'type' => 'program',
            'body' => 'Sharing a program',
            'payload' => [
                'name' => 'Program',
                'category' => 'improving',
                'goal' => 'Goal',
                'length' => 30,
                'tasks' => [['name' => 'No type']],
            ],
        ])->assertUnprocessable()->assertJsonStructure(['errors' => ['payload.tasks.0.type']]);

        $this->assertSame(0, Post::count());
    }

    /** @param  array<string, mixed>  $overrides */
    private function makeTestamentPost(array $overrides = []): Post
    {
        return Post::create([
            'space_id' => $this->space->id,
            'author_id' => $this->profile->id,
            'type' => 'testament',
            'body' => 'Test',
            'payload' => ['category' => 'akhira', 'text' => 'Text'],
            'audience' => 'everyone',
            'status' => 'published',
            ...$overrides,
        ]);
    }

    private function femaleProfile(): CommunityProfile
    {
        return CommunityProfile::create([
            'user_id' => User::factory()->create()->id,
            'first_name' => 'Sister',
            'last_name' => 'User',
            'gender' => 'female',
            'status' => 'active',
            'joined_at' => now(),
        ]);
    }

    private function otherGenderSpace(): Space
    {
        return Space::create([
            ...$this->spaceFields(),
            'slug' => 'sisters',
            'owner_id' => $this->femaleProfile()->id,
            'gender' => 'female',
        ]);
    }

    /** @return array<string, mixed> */
    private function spaceFields(): array
    {
        return [
            'type' => 'group',
            'name' => 'Group',
            'purpose' => 'Testing',
            'goals' => 'Goals',
            'content_plan' => 'Plan',
            'gender' => 'male',
            'join_policy' => 'open',
            'status' => 'active',
        ];
    }
}
