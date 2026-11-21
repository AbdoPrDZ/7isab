<?php

namespace Tests\Feature\Community;

use App\Models\User;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\CommunityRule;
use Database\Seeders\CommunityRuleSeeder;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class JoinTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CommunityRuleSeeder::class);
        $this->user = User::factory()->create();
    }

    public function test_status_of_a_user_who_never_joined(): void
    {
        $this->asUser()->getJson('/api/v1/community/me')
            ->assertOk()
            ->assertJson(['profile' => null, 'pending_rules' => []]);
    }

    public function test_rules_are_listed_in_order_with_all_languages(): void
    {
        $response = $this->asUser()->getJson('/api/v1/community/rules')->assertOk();

        $this->assertSame(CommunityRule::orderBy('order')->pluck('key')->all(), array_column($response->json('rules'), 'key'));
        $this->assertSame(['ar', 'en', 'fr'], array_keys($response->json('rules.0.texts')));
    }

    public function test_joining_requires_every_rule_in_its_current_version(): void
    {
        $acceptances = $this->allAcceptances();
        array_pop($acceptances);

        $this->join(['rule_acceptances' => $acceptances])
            ->assertUnprocessable()
            ->assertJsonStructure(['errors' => ['rule_acceptances']]);

        $stale = $this->allAcceptances();
        $stale[0]['version'] = 0;
        $this->join(['rule_acceptances' => $stale])->assertUnprocessable();

        $this->assertDatabaseCount('community_profiles', 0);
    }

    public function test_joining_creates_the_profile_and_records_each_rule(): void
    {
        $this->join()->assertCreated()->assertJsonPath('profile.gender', 'female');

        $profile = CommunityProfile::where('user_id', $this->user->id)->sole();
        $this->assertSame('active', $profile->status);
        $this->assertDatabaseCount('rule_acceptances', CommunityRule::count());
    }

    public function test_joining_twice_is_refused(): void
    {
        $this->join()->assertCreated();
        $this->join()->assertStatus(409);
    }

    public function test_rejoining_after_leaving_keeps_the_gender(): void
    {
        $this->join()->assertCreated();
        $this->asUser()->postJson('/api/v1/community/leave')->assertOk();
        $this->assertSame('left', $this->profile()->status);

        $this->join(['gender' => 'male'])->assertUnprocessable();

        $this->join(['first_name' => 'Back', 'gender' => null])
            ->assertOk()
            ->assertJsonPath('profile.gender', 'female')
            ->assertJsonPath('profile.first_name', 'Back');
        $this->assertSame(1, CommunityProfile::count());
    }

    public function test_a_banned_or_suspended_member_cannot_rejoin(): void
    {
        $this->join()->assertCreated();
        $this->profile()->update(['status' => 'banned']);

        $this->join(['gender' => null])->assertForbidden()->assertJsonPath('reason', 'banned');
    }

    public function test_a_changed_rule_must_be_accepted_again_before_taking_part(): void
    {
        $this->join()->assertCreated();
        $rule = CommunityRule::orderBy('order')->first();
        $rule->increment('version');

        $this->asUser()->getJson('/api/v1/community/feed')
            ->assertForbidden()
            ->assertJsonPath('reason', 'rules_pending');

        $this->asUser()->getJson('/api/v1/community/me')
            ->assertJsonCount(1, 'pending_rules')
            ->assertJsonPath('pending_rules.0.key', $rule->key);

        $this->asUser()->postJson('/api/v1/community/rules/accept', [
            'rule_acceptances' => [['key' => $rule->key, 'version' => $rule->version - 1]],
        ])->assertUnprocessable();

        $this->asUser()->postJson('/api/v1/community/rules/accept', [
            'rule_acceptances' => [['key' => $rule->key, 'version' => $rule->version]],
        ])->assertOk();

        $this->asUser()->getJson('/api/v1/community/feed')->assertOk();
    }

    public function test_members_can_change_their_names_but_not_their_gender(): void
    {
        $this->join()->assertCreated();

        $this->asUser()->putJson('/api/v1/community/me', [
            'first_name' => 'New',
            'last_name' => 'Name',
            'gender' => 'male',
        ])->assertOk()->assertJsonPath('profile.first_name', 'New');

        $this->assertSame('female', $this->profile()->gender);
    }

    public function test_a_non_member_cannot_read_the_feed_or_leave(): void
    {
        $this->asUser()->getJson('/api/v1/community/feed')->assertForbidden()->assertJsonPath('reason', 'not_member');
        $this->asUser()->postJson('/api/v1/community/leave')->assertForbidden();
    }

    /** @param  array<string, mixed>  $overrides */
    private function join(array $overrides = []): TestResponse
    {
        $body = array_filter([
            'first_name' => 'Sister',
            'last_name' => 'Member',
            'gender' => 'female',
            'rule_acceptances' => $this->allAcceptances(),
            ...$overrides,
        ], fn ($value) => $value !== null);

        return $this->asUser()->postJson('/api/v1/community/join', $body);
    }

    /** @return list<array{key: string, version: int}> */
    private function allAcceptances(): array
    {
        return CommunityRule::orderBy('order')->get()->map(fn (CommunityRule $rule) => ['key' => $rule->key, 'version' => $rule->version])->all();
    }

    /** A fresh user per request, as in production (no cached profile relation). */
    private function asUser(): static
    {
        return $this->actingAs($this->user->fresh());
    }

    private function profile(): CommunityProfile
    {
        return CommunityProfile::where('user_id', $this->user->id)->sole();
    }
}
