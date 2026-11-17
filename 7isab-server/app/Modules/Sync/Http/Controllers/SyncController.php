<?php

namespace App\Modules\Sync\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\SyncRecord;
use App\Modules\Sync\Actions\PushRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Offline-first sync of encrypted records. The server never sees record
 * contents: only ids, types, timestamps and sizes.
 */
class SyncController extends Controller
{
    /** Device → server: local changes. Answers with the sequence number of each. */
    public function push(Request $request, PushRecords $push): JsonResponse
    {
        $max = config('hisab.sync.max_push');
        $data = $request->validate([
            'records' => "present|array|max:$max",
            ...SyncRecord::changeRules('records.*'),
        ]);

        $results = $push->handle($request->user(), array_map(fn (array $record): array => [
            'id' => strtolower($record['id']),
            'type' => $record['type'],
            'payload' => $record['payload'] ?? null,
            'updated_at' => (int) $record['updated_at'],
            'deleted_at' => isset($record['deleted_at']) ? (int) $record['deleted_at'] : null,
        ], $data['records']));

        return self::apiSuccessResponse('Pushed', ['records' => $results]);
    }

    /** Server → device: everything changed after sequence number `since`, in pages (by count and by size). */
    public function pull(Request $request): JsonResponse
    {
        $data = $request->validate(['since' => 'nullable|integer|min:0']);
        $since = (int) ($data['since'] ?? 0);
        $max = config('hisab.sync.max_pull');
        $user = $request->user();

        $records = SyncRecord::query()
            ->where('user_id', $user->id)
            ->where('seq', '>', $since)
            ->orderBy('seq')
            ->limit($max + 1)
            ->get();

        $hasMore = $records->count() > $max;
        $records = $records->take($max);

        // Keep each page small enough for a phone: stop at the byte budget (always at least one record).
        $budget = (int) config('hisab.sync.max_pull_bytes');
        $bytes = 0;
        $page = $records->takeWhile(function (SyncRecord $record, int $index) use (&$bytes, $budget): bool {
            $bytes += (int) $record->payload_size;

            return $index === 0 || $bytes <= $budget;
        });
        $hasMore = $hasMore || $page->count() < $records->count();
        $records = $page;
        $user->forceFill(['last_sync_at' => now()])->save();

        return self::apiSuccessResponse('Changes', [
            'records' => $records->map->toArray()->values(),
            'cursor' => $records->last()?->seq ?? $since,
            'has_more' => $hasMore,
        ]);
    }
}
