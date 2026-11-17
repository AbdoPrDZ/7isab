<?php

use App\Modules\Vault\Http\Controllers\VaultController;
use Illuminate\Support\Facades\Route;

/*
| Locked data keys — /api/v1/vault/*
*/

Route::prefix('vault')->name('vault.')->middleware(['auth:sanctum', 'abilities:app', 'active'])->group(function (): void {
    Route::get('key', [VaultController::class, 'show'])->name('key');
    Route::put('recovery', [VaultController::class, 'replaceRecovery'])->middleware('throttle:auth')->name('recovery');
});
