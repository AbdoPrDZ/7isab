<?php

namespace App\Modules\Sync\Actions;

use App\Models\SyncRecord;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Stores pushed changes. Each applied change gets the user's next sequence
 * number. Newest edit wins: a change older than the stored version is not
 * applied, but it is still acknowledged (the device pulls the newer one).
 */
class PushRecords
{
    /**
     * @param  array<int, array{id: string, type: string, payload: ?string, updated_at: int, deleted_at: ?int}>  $changes
     * @return array<int, array{id: string, updated_at: int, seq: int, applied: bool}>
     */
    public function handle(User $user, array $changes): array
    {
        return DB::transaction(function () use ($user, $changes): array {
            // Lock the user row: sequence numbers must be unique and increasing.
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $seq = $locked->sync_seq;

            $existing = SyncRecord::query()
                ->where('user_id', $user->id)
                ->whereIn('uid', array_column($changes, 'id'))
                ->get()
                ->keyBy('uid');

            $results = [];
            $sizeDelta = 0;

            foreach ($changes as $change) {
                $record = $existing->get($change['id']);
                $incomingAt = $change['updated_at'];

                if ($record && SyncRecord::toMillis($record->client_updated_at) > $incomingAt) {
                    $results[] = ['id' => $change['id'], 'updated_at' => $incomingAt, 'seq' => $record->seq, 'applied' => false];

                    continue;
                }

                $payload = $change['deleted_at'] !== null ? null : $change['payload'];
                $size = $payload === null ? 0 : strlen($payload);
                $sizeDelta += $size - ($record?->payload_size ?? 0);
                $seq++;

                $record ??= new SyncRecord(['user_id' => $user->id, 'uid' => $change['id']]);
                $record->fill([
                    'type' => $change['type'],
                    'seq' => $seq,
                    'payload' => $payload,
                    'payload_size' => $size,
                    'client_updated_at' => SyncRecord::fromMillis($incomingAt),
                    'client_deleted_at' => SyncRecord::fromMillis($change['deleted_at']),
                ])->save();
                $existing->put($change['id'], $record);

                $results[] = ['id' => $change['id'], 'updated_at' => $incomingAt, 'seq' => $seq, 'applied' => true];
            }

            $locked->forceFill([
                'sync_seq' => $seq,
                'storage_bytes' => max(0, $locked->storage_bytes + $sizeDelta),
                'last_sync_at' => now(),
            ])->save();

            return $results;
        });
    }
}
