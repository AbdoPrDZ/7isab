<?php

use App\Modules\Auth\Http\Controllers\AuthController;
use App\Modules\Auth\Http\Controllers\RecoveryController;
use Illuminate\Support\Facades\Route;

/*
| App-user authentication — /api/v1/auth/*
*/

Route::prefix('auth')->name('auth.')->group(function (): void {
    Route::middleware('throttle:auth')->group(function (): void {
        Route::post('prelogin', [AuthController::class, 'prelogin'])->name('prelogin');
        Route::post('register', [AuthController::class, 'register'])->name('register');
        Route::post('login', [AuthController::class, 'login'])->name('login');
    });

    Route::prefix('recovery')->name('recovery.')->middleware('throttle:recovery')->group(function (): void {
        Route::post('params', [RecoveryController::class, 'params'])->name('params');
        Route::post('unlock', [RecoveryController::class, 'unlock'])->name('unlock');
        Route::post('reset', [RecoveryController::class, 'reset'])->name('reset');
    });

    Route::middleware(['auth:sanctum', 'abilities:app', 'active'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
        Route::post('logout-all', [AuthController::class, 'logoutAll'])->name('logout-all');
        Route::put('password', [AuthController::class, 'changePassword'])->middleware('throttle:auth')->name('password');
    });
});
