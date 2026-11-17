<?php

use App\Enums\Role;
use App\Modules\Admin\Http\Controllers\AdminAuthController;
use App\Modules\Admin\Http\Controllers\AdminController;
use App\Modules\Admin\Http\Controllers\StatsController;
use App\Modules\Admin\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
| Admin panel API — /api/v1/admin/*
|
| Roles are fixed: super-admin (everything) and admin (app users only).
*/

$superAdmin = 'role:'.Role::SuperAdmin->value;
$anyAdmin = 'role:'.implode(',', Role::values());

Route::prefix('admin')->name('admin.')->group(function () use ($superAdmin, $anyAdmin): void {
    Route::post('auth/login', [AdminAuthController::class, 'login'])->middleware('throttle:auth')->name('auth.login');

    Route::middleware(['auth:sanctum', 'abilities:admin', 'active', $anyAdmin])->group(function () use ($superAdmin): void {
        Route::get('auth/me', [AdminAuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AdminAuthController::class, 'logout'])->name('auth.logout');

        Route::get('stats', [StatsController::class, 'index'])->name('stats');

        Route::prefix('users')->name('users.')->group(function (): void {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::get('{user}', [UserController::class, 'show'])->whereNumber('user')->name('show');
            Route::post('{user}/disable', [UserController::class, 'disable'])->whereNumber('user')->name('disable');
            Route::post('{user}/enable', [UserController::class, 'enable'])->whereNumber('user')->name('enable');
            Route::post('{user}/sign-out', [UserController::class, 'signOut'])->whereNumber('user')->name('sign-out');
            Route::delete('{user}', [UserController::class, 'destroy'])->whereNumber('user')->name('destroy');
        });

        Route::prefix('admins')->name('admins.')->middleware($superAdmin)->group(function (): void {
            Route::get('/', [AdminController::class, 'index'])->name('index');
            Route::post('/', [AdminController::class, 'store'])->name('store');
            Route::get('{admin}', [AdminController::class, 'show'])->whereNumber('admin')->name('show');
            Route::put('{admin}', [AdminController::class, 'update'])->whereNumber('admin')->name('update');
            Route::delete('{admin}', [AdminController::class, 'destroy'])->whereNumber('admin')->name('destroy');
        });
    });
});
