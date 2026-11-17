<?php

use App\Modules\Sync\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

/*
| Encrypted record sync — /api/v1/sync/*
*/

Route::prefix('sync')->name('sync.')->middleware(['auth:sanctum', 'abilities:app', 'active', 'throttle:api'])->group(function (): void {
    Route::post('push', [SyncController::class, 'push'])->name('push');
    Route::get('pull', [SyncController::class, 'pull'])->name('pull');
});
