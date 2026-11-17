<?php

use App\Modules\Quran\Http\Controllers\QuranController;
use Illuminate\Support\Facades\Route;

/*
| Public Quran text — /api/v1/quran/*
*/

Route::prefix('quran')->name('quran.')->middleware('throttle:api')->group(function (): void {
    Route::get('meta', [QuranController::class, 'meta'])->name('meta');
    Route::get('pages/{page}', [QuranController::class, 'page'])->whereNumber('page')->name('page');
});
