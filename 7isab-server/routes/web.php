<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/*
| Admin panel (React SPA). Every /admin path serves the same page; the SPA routes
| on the client and talks to /api/v1/admin with an admin token.
*/
Route::view('/admin/{path?}', 'admin')->where('path', '.*')->name('admin');
