<?php

use Illuminate\Support\Facades\Route;
use App\Modules\Community\Http\Controllers\JoinController;
use App\Modules\Community\Http\Controllers\SpaceController;
use App\Modules\Community\Http\Controllers\PostController;
use App\Modules\Community\Http\Controllers\CommentController;
use App\Modules\Community\Http\Controllers\ShaiekhController;
use App\Modules\Community\Http\Controllers\ChatController;
use App\Modules\Community\Http\Controllers\ReportController;
use App\Modules\Community\Http\Controllers\AdminController;

Route::prefix('community')
    ->middleware(['auth:sanctum', 'active', 'is_community_member'])
    ->group(function () {

        // Joining
        Route::get('/rules', [JoinController::class, 'rules']);
        Route::post('/join', [JoinController::class, 'join']);
        Route::post('/leave', [JoinController::class, 'leave']);
        Route::get('/me', [JoinController::class, 'profile']);
        Route::put('/me', [JoinController::class, 'updateProfile']);

        // Spaces
        Route::get('/spaces', [SpaceController::class, 'discover']);
        Route::get('/spaces/{slug}', [SpaceController::class, 'show']);
        Route::post('/spaces/{id}/join', [SpaceController::class, 'join']);
        Route::post('/spaces/{id}/leave', [SpaceController::class, 'leave']);
        Route::post('/spaces/{id}/follow', [SpaceController::class, 'follow']);
        Route::post('/spaces/{id}/unfollow', [SpaceController::class, 'unfollow']);
        Route::post('/space-requests', [SpaceController::class, 'requestCreation']);
        Route::get('/space-requests/mine', [SpaceController::class, 'myRequests']);

        // Posts
        Route::get('/feed', [PostController::class, 'feed']);
        Route::get('/spaces/{id}/posts', [PostController::class, 'spacePosts']);
        Route::post('/spaces/{id}/posts', [PostController::class, 'store']);
        Route::put('/posts/{id}', [PostController::class, 'update']);
        Route::delete('/posts/{id}', [PostController::class, 'destroy']);
        Route::post('/posts/{id}/save', [PostController::class, 'save']);
        Route::post('/posts/{id}/import', [PostController::class, 'import']);

        // Comments
        Route::get('/posts/{id}/comments', [CommentController::class, 'index']);
        Route::post('/posts/{id}/comments', [CommentController::class, 'store']);
        Route::delete('/comments/{id}', [CommentController::class, 'destroy']);

        // Shaykhs and Fatwa
        Route::post('/shaykh-requests', [ShaiekhController::class, 'requestTrust']);
        Route::get('/shaykhs', [ShaiekhController::class, 'index']);
        Route::post('/fatwa-questions', [ShaiekhController::class, 'askQuestion']);
        Route::get('/fatwa/mine', [ShaiekhController::class, 'myQuestions']);
        Route::get('/fatwas', [ShaiekhController::class, 'publishedFatwas']);
        Route::post('/fatwa-threads/{id}/publish-proposal', [ShaiekhController::class, 'proposePublish']);
        Route::post('/fatwa-publications/{id}/approve', [ShaiekhController::class, 'approveFatwa']);
        Route::post('/fatwa-publications/{id}/refuse', [ShaiekhController::class, 'refuseFatwa']);

        // Chats
        Route::put('/chat-key', [ChatController::class, 'uploadKey']);
        Route::get('/users/{id}/chat-key', [ChatController::class, 'getKey']);
        Route::post('/conversations', [ChatController::class, 'createConversation']);
        Route::get('/conversations', [ChatController::class, 'listConversations']);
        Route::get('/conversations/{id}/messages', [ChatController::class, 'messages']);
        Route::post('/conversations/{id}/messages', [ChatController::class, 'sendMessage']);
        Route::post('/messages/{id}/reactions', [ChatController::class, 'addReaction']);
        Route::delete('/messages/{id}/reactions/{emoji}', [ChatController::class, 'removeReaction']);

        // Safety
        Route::post('/reports', [ReportController::class, 'store']);
        Route::post('/blocks', [ReportController::class, 'block']);
        Route::delete('/blocks/{id}', [ReportController::class, 'unblock']);
        Route::post('/mutes', [ReportController::class, 'mute']);
        Route::delete('/mutes/{id}', [ReportController::class, 'unmute']);
    });

// Admin routes for community (nested under admin)
// These routes are auto-discovered by the admin module
// Routes: /api/v1/admin/community/*
Route::prefix('admin/community')
    ->middleware(['auth:sanctum', 'active', 'abilities:admin'])
    ->group(function () {
        Route::get('/space-requests', [AdminController::class, 'spaceRequests']);
        Route::post('/space-requests/{id}/approve', [AdminController::class, 'approveSpaceRequest']);
        Route::post('/space-requests/{id}/reject', [AdminController::class, 'rejectSpaceRequest']);
        Route::post('/space-requests/{id}/request-changes', [AdminController::class, 'requestChanges']);

        Route::get('/shaykh-requests', [AdminController::class, 'shaiekhRequests']);
        Route::post('/shaykh-requests/{id}/approve', [AdminController::class, 'approveShaiekhRequest']);
        Route::post('/shaykh-requests/{id}/reject', [AdminController::class, 'rejectShaiekhRequest']);

        Route::get('/reports', [AdminController::class, 'reports']);
        Route::post('/reports/{id}/hide', [AdminController::class, 'hideContent']);
        Route::post('/reports/{id}/warn', [AdminController::class, 'warnUser']);
        Route::post('/reports/{id}/suspend', [AdminController::class, 'suspendUser']);
        Route::post('/reports/{id}/ban', [AdminController::class, 'banUser']);

        Route::get('/members', [AdminController::class, 'members']);
        Route::post('/members/{id}/suspend', [AdminController::class, 'suspendMember']);
        Route::post('/members/{id}/ban', [AdminController::class, 'banMember']);
        Route::put('/members/{id}/gender', [AdminController::class, 'changeGender']);

        Route::get('/rules', [AdminController::class, 'rules']);
        Route::put('/rules/{key}', [AdminController::class, 'updateRule']);

        Route::get('/spaces', [AdminController::class, 'spaces']);
        Route::post('/spaces/{id}/close', [AdminController::class, 'closeSpace']);
        Route::post('/spaces/{id}/transfer', [AdminController::class, 'transferSpace']);
    });
