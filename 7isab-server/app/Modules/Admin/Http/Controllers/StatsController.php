<?php

namespace App\Modules\Admin\Http\Controllers;

use App\Core\Http\Controller;
use App\Models\SyncRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * Overall numbers for the admin dashboard. Counts only; no user data.
 */
class StatsController extends Controller
{
    public function index(): JsonResponse
    {
        $appUsers = fn () => User::query()->whereDoesntHave('roles');

        return self::apiSuccessResponse('Statistics', [
            'statistics' => [
                'users' => [
                    'total' => $appUsers()->count(),
                    'active' => $appUsers()->where('is_active', true)->count(),
                    'disabled' => $appUsers()->where('is_active', false)->count(),
                    'new_last_30_days' => $appUsers()->where('created_at', '>=', Carbon::now()->subDays(30))->count(),
                    'synced_last_7_days' => $appUsers()->where('last_sync_at', '>=', Carbon::now()->subDays(7))->count(),
                ],
                'admins' => User::query()->whereHas('roles')->count(),
                'records' => SyncRecord::query()->count(),
                'storage_bytes' => (int) $appUsers()->sum('storage_bytes'),
            ],
        ]);
    }
}
