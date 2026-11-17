<?php

use Illuminate\Support\Facades\Route;

/*
| API v1. Each module owns its routes in app/Modules/<Module>/routes.php.
*/

Route::prefix('v1')->name('v1.')->group(function (): void {
    Route::get('health', fn () => response()->json(['success' => true, 'message' => 'OK']))->name('health');

    require app_path('Modules/Auth/routes.php');
    require app_path('Modules/Vault/routes.php');
    require app_path('Modules/Admin/routes.php');
    require app_path('Modules/Quran/routes.php');
    require app_path('Modules/Sync/routes.php');
});
