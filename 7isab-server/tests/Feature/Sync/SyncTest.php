<?php

namespace Tests\Feature\Sync;

use Illuminate\Support\Str;
use Tests\TestCase;

class SyncTest extends TestCase
{
    private function change(array $overrides = []): array
    {
        return [
            'id' => (string) Str::uuid(),
            'type' => 'entry',
            'payload' => base64_encode('ciphertext'),
            'updated_at' => 1_700_000_000_000,
            'deleted_at' => null,
            ...$overrides,
        ];
    }

    public function test_push_assigns_increasing_sequence_numbers_and_pull_returns_them(): void
    {
        $user = $this->createAppUser();
        $headers = $this->appHeaders($user);
        $first = $this->change();
        $second = $this->change(['type' => 'account']);

        $this->withHeaders($headers)->postJson('/api/v1/sync/push', ['records' => [$first, $second]])
            ->assertOk()
            ->assertJsonPath('records.0.seq', 1)
            ->assertJsonPath('records.1.seq', 2)
            ->assertJsonPath('records.0.applied', true);

        $this->withHeaders($headers)->getJson('/api/v1/sync/pull?since=0')
            ->assertOk()
            ->assertJsonCount(2, 'records')
            ->assertJsonPath('records.0.id', $first['id'])
            ->assertJsonPath('records.0.payload', $first['payload'])
            ->assertJsonPath('records.0.updated_at', $first['updated_at'])
            ->assertJsonPath('cursor', 2)
            ->assertJsonPath('has_more', false);

        $this->withHeaders($headers)->getJson('/api/v1/sync/pull?since=2')
            ->assertOk()
            ->assertJsonCount(0, 'records')
            ->assertJsonPath('cursor', 2);

        $this->assertSame(strlen($first['payload']) * 2, $user->fresh()->storage_bytes);
        $this->assertNotNull($user->fresh()->last_sync_at);
    }

    public function test_newest_edit_wins(): void
    {
        $user = $this->createAppUser();
        $headers = $this->appHeaders($user);
        $record = $this->change(['updated_at' => 2_000]);

        $this->withHeaders($headers)->postJson('/api/v1/sync/push', ['records' => [$record]])->assertOk();

        // An older edit is acknowledged but not applied.
        $this->withHeaders($headers)
            ->postJson('/api/v1/sync/push', ['records' => [[...$record, 'payload' => 'older', 'updated_at' => 1_000]]])
            ->assertOk()
            ->assertJsonPath('records.0.applied', false)
            ->assertJsonPath('records.0.seq', 1);

        // A newer edit replaces it with a new sequence number.
        $this->withHeaders($headers)
            ->postJson('/api/v1/sync/push', ['records' => [[...$record, 'payload' => 'newer', 'updated_at' => 3_000]]])
            ->assertOk()
            ->assertJsonPath('records.0.applied', true)
            ->assertJsonPath('records.0.seq', 2);

        $this->withHeaders($headers)->getJson('/api/v1/sync/pull?since=0')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.payload', 'newer');
    }

    public function test_deletions_sync_as_tombstones(): void
    {
        $user = $this->createAppUser();
        $headers = $this->appHeaders($user);
        $record = $this->change(['updated_at' => 1_000]);

        $this->withHeaders($headers)->postJson('/api/v1/sync/push', ['records' => [$record]])->assertOk();
        $this->withHeaders($headers)
            ->postJson('/api/v1/sync/push', ['records' => [[...$record, 'payload' => 'tombstone', 'updated_at' => 2_000, 'deleted_at' => 2_000]]])
            ->assertOk();

        $this->withHeaders($headers)->getJson('/api/v1/sync/pull?since=1')
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.deleted_at', 2_000)
            ->assertJsonPath('records.0.payload', null);
        $this->assertSame(0, $user->fresh()->storage_bytes);
    }

    public function test_users_only_see_their_own_records(): void
    {
        $alice = $this->createAppUser();
        $bob = $this->createAppUser(['email' => 'bob@example.com']);

        $this->withHeaders($this->appHeaders($alice))->postJson('/api/v1/sync/push', ['records' => [$this->change()]])->assertOk();

        // Fresh guard per user (the test app keeps the resolved user between requests).
        $this->forgetAuth();
        $this->withHeaders($this->appHeaders($bob))->getJson('/api/v1/sync/pull?since=0')
            ->assertOk()
            ->assertJsonCount(0, 'records');
    }

    public function test_pull_pages_with_has_more(): void
    {
        config(['hisab.sync.max_pull' => 2]);
        $user = $this->createAppUser();
        $headers = $this->appHeaders($user);
        $this->withHeaders($headers)
            ->postJson('/api/v1/sync/push', ['records' => [$this->change(), $this->change(), $this->change()]])
            ->assertOk();

        $this->withHeaders($headers)->getJson('/api/v1/sync/pull?since=0')
            ->assertJsonCount(2, 'records')
            ->assertJsonPath('cursor', 2)
            ->assertJsonPath('has_more', true);
    }

    public function test_invalid_changes_are_rejected(): void
    {
        $headers = $this->appHeaders($this->createAppUser());

        $this->withHeaders($headers)
            ->postJson('/api/v1/sync/push', ['records' => [$this->change(['id' => 'not-a-uuid', 'type' => 'Bad Type'])]])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['records.0.id', 'records.0.type']]);
    }

    public function test_sync_requires_an_app_token(): void
    {
        $this->getJson('/api/v1/sync/pull')->assertStatus(401);
        $this->withHeaders($this->adminHeaders($this->createAdmin()))->getJson('/api/v1/sync/pull')->assertStatus(403);
    }
}
