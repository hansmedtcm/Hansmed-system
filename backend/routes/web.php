<?php

use Illuminate\Support\Facades\Route;

// Root URL — show API info
Route::get('/', function () {
    return response()->json([
        'name'    => 'HansMed TCM Platform API',
        'version' => '1.0.0',
        'status'  => 'online',
        'docs'    => '/api',
    ]);
});

// Catch the "login" route that Sanctum redirects to
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated. Please provide a Bearer token.'], 401);
})->name('login');
