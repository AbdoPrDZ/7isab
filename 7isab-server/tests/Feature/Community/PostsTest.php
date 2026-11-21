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

        $response->assertStatus(500);
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

        $response->assertStatus(500);
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

        $response->assertCreated();
        $response->assertJson(['message' => 'Post imported']);

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

        $response->assertCreated();
        $response->assertJson(['message' => 'Post imported']);

        $this->assertDatabaseHas('imports', [
            'profile_id' => $this->profile->id,
            'post_id' => $post->id,
        ]);
    }
}
