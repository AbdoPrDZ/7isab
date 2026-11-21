<?php

namespace Tests\Feature\Community;

use App\Models\User;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\CommunityRule;
use Database\Seeders\CommunityRuleSeeder;
use Tests\TestCase;

class AdminCommunityTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(CommunityRuleSeeder::class);
        $this->admin = $this->createAdmin();
    }

    public function test_app_users_cannot_reach_the_community_admin(): void
    {
        $user = $this->createAppUser();

        $this->withHeaders($this->appHeaders($user))->getJson('/api/v1/admin/community/rules')->assertForbidden();
    }

    public function test_admin_lists_and_creates_rules(): void
    {
        $this->asAdmin()->getJson('/api/v1/admin/community/rules')
            ->assertOk()
            ->assertJsonCount(CommunityRule::count(), 'items');

        $this->forgetAuth();
        $this->asAdmin()->postJson('/api/v1/admin/community/rules', [
            'key' => 'kind_words',
            'texts' => ['ar' => 'كلام طيب', 'en' => 'Kind words', 'fr' => 'Paroles bienveillantes'],
        ])->assertCreated()->assertJsonPath('item.version', 1);

        $this->forgetAuth();
        $this->asAdmin()->postJson('/api/v1/admin/community/rules', [
            'key' => 'kind_words',
            'texts' => ['ar' => 'x', 'en' => 'x', 'fr' => 'x'],
        ])->assertUnprocessable();
    }

    public function test_rule_version_changes_only_for_a_change_in_substance(): void
    {
        $rule = CommunityRule::orderBy('order')->first();
        $texts = ['ar' => 'نص', 'en' => 'Text', 'fr' => 'Texte'];

        $this->asAdmin()->putJson("/api/v1/admin/community/rules/{$rule->id}", ['texts' => $texts, 'changed' => false])
            ->assertOk()
            ->assertJsonPath('item.version', 1);

        $this->forgetAuth();
        $this->asAdmin()->putJson("/api/v1/admin/community/rules/{$rule->id}", ['texts' => $texts, 'changed' => true])
            ->assertOk()
            ->assertJsonPath('item.version', 2)
            ->assertJsonPath('item.texts.en', 'Text');
    }

    public function test_admin_deletes_a_rule(): void
    {
        $rule = CommunityRule::first();

        $this->asAdmin()->deleteJson("/api/v1/admin/community/rules/{$rule->id}")->assertOk();
        $this->assertModelMissing($rule);
    }

    public function test_members_list_filters_gender_exactly(): void
    {
        $this->member('male');
        $this->member('female');

        $this->asAdmin()->getJson('/api/v1/admin/community/members?gender=male')
            ->assertOk()
            ->assertJsonPath('itemsCount', 1)
            ->assertJsonPath('items.0.gender', 'male')
            ->assertJsonStructure(['items' => [['id', 'user_id', 'email', 'first_name', 'last_name', 'status']]]);
    }

    public function test_admin_suspends_bans_reactivates_and_changes_gender(): void
    {
        $member = $this->member('male');
        $base = "/api/v1/admin/community/members/{$member->id}";

        $this->asAdmin()->postJson("{$base}/suspend")->assertOk()->assertJsonPath('item.status', 'suspended');
        $this->forgetAuth();
        $this->asAdmin()->postJson("{$base}/ban")->assertOk()->assertJsonPath('item.status', 'banned');
        $this->forgetAuth();
        $this->asAdmin()->postJson("{$base}/reactivate")->assertOk()->assertJsonPath('item.status', 'active');
        $this->forgetAuth();
        $this->asAdmin()->postJson("{$base}/reactivate")->assertStatus(409);
        $this->forgetAuth();
        $this->asAdmin()->putJson("{$base}/gender", ['gender' => 'female'])->assertOk()->assertJsonPath('item.gender', 'female');
    }

    public function test_a_suspended_member_is_locked_out(): void
    {
        $member = $this->member('male');
        $member->update(['status' => 'suspended']);

        $this->actingAs($member->user)->getJson('/api/v1/community/feed')
            ->assertForbidden()
            ->assertJsonPath('reason', 'suspended');
    }

    private function asAdmin(): static
    {
        return $this->withHeaders($this->adminHeaders($this->admin));
    }

    private function member(string $gender): CommunityProfile
    {
        return CommunityProfile::create([
            'user_id' => $this->createAppUser()->id,
            'first_name' => ucfirst($gender),
            'last_name' => 'Member',
            'gender' => $gender,
            'status' => 'active',
            'joined_at' => now(),
        ]);
    }
}
