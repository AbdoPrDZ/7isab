<?php

use App\Enums\Role;
use App\Modules\Community\Http\Controllers\Admin\MemberController;
use App\Modules\Community\Http\Controllers\Admin\ReportAdminController;
use App\Modules\Community\Http\Controllers\Admin\RuleController;
use App\Modules\Community\Http\Controllers\Admin\ShaykhAdminController;
use App\Modules\Community\Http\Controllers\Admin\SpaceAdminController;
use App\Modules\Community\Http\Controllers\ChatController;
use App\Modules\Community\Http\Controllers\CommentController;
use App\Modules\Community\Http\Controllers\FatwaController;
use App\Modules\Community\Http\Controllers\JoinController;
use App\Modules\Community\Http\Controllers\PostController;
use App\Modules\Community\Http\Controllers\ReportController;
use App\Modules\Community\Http\Controllers\ShaykhController;
use App\Modules\Community\Http\Controllers\SpaceController;
use App\Modules\Community\Http\Controllers\SpaceMemberController;
use Illuminate\Support\Facades\Route;

// Joining: open to every signed-in user (members or not).
Route::prefix('community')
    ->middleware(['auth:sanctum', 'active'])
    ->group(function () {
        Route::get('/rules', [JoinController::class, 'rules']);
        Route::get('/me', [JoinController::class, 'status']);
        Route::post('/join', [JoinController::class, 'join']);
    });

// Members who may still have new or changed rules to accept.
Route::prefix('community')
    ->middleware(['auth:sanctum', 'active', 'is_community_member:pending_rules'])
    ->group(function () {
        Route::post('/rules/accept', [JoinController::class, 'acceptRules']);
        Route::put('/me', [JoinController::class, 'updateProfile']);
        Route::post('/leave', [JoinController::class, 'leave']);
    });

Route::prefix('community')
    ->middleware(['auth:sanctum', 'active', 'is_community_member'])
    ->group(function () {

        // Spaces
        Route::get('/spaces', [SpaceController::class, 'index']);
        Route::get('/spaces/{slug}', [SpaceController::class, 'show'])->where('slug', '[A-Za-z0-9-]+');
        Route::post('/spaces/{id}/join', [SpaceController::class, 'join'])->whereNumber('id');
        Route::post('/spaces/{id}/leave', [SpaceController::class, 'leave'])->whereNumber('id');
        Route::post('/spaces/{id}/follow', [SpaceController::class, 'follow'])->whereNumber('id');
        Route::post('/spaces/{id}/unfollow', [SpaceController::class, 'unfollow'])->whereNumber('id');
        Route::put('/spaces/{id}/settings', [SpaceController::class, 'updateSettings'])->whereNumber('id');
        Route::post('/space-requests', [SpaceController::class, 'requestCreation']);
        Route::get('/space-requests/mine', [SpaceController::class, 'myRequests']);
        Route::put('/space-requests/{id}', [SpaceController::class, 'updateRequest'])->whereNumber('id');

        // Moderation (owner and moderators)
        Route::get('/spaces/{id}/members', [SpaceMemberController::class, 'index'])->whereNumber('id');
        Route::post('/spaces/{id}/members/{member}/approve', [SpaceMemberController::class, 'approve'])->whereNumber(['id', 'member']);
        Route::post('/spaces/{id}/members/{member}/reject', [SpaceMemberController::class, 'reject'])->whereNumber(['id', 'member']);
        Route::post('/spaces/{id}/members/{member}/ban', [SpaceMemberController::class, 'ban'])->whereNumber(['id', 'member']);
        Route::post('/spaces/{id}/members/{member}/unban', [SpaceMemberController::class, 'unban'])->whereNumber(['id', 'member']);
        Route::put('/spaces/{id}/members/{member}/role', [SpaceMemberController::class, 'setRole'])->whereNumber(['id', 'member']);

        // Posts
        Route::get('/feed', [PostController::class, 'feed']);
        Route::get('/saved-posts', [PostController::class, 'saved']);
        Route::get('/events', [PostController::class, 'events']);
        Route::get('/spaces/{id}/posts', [PostController::class, 'spacePosts'])->whereNumber('id');
        Route::post('/spaces/{id}/posts', [PostController::class, 'store'])->whereNumber('id');
        Route::get('/spaces/{id}/pending-posts', [PostController::class, 'pending'])->whereNumber('id');
        Route::get('/posts/{id}', [PostController::class, 'show'])->whereNumber('id');
        Route::put('/posts/{id}', [PostController::class, 'update'])->whereNumber('id');
        Route::delete('/posts/{id}', [PostController::class, 'destroy'])->whereNumber('id');
        Route::post('/posts/{id}/approve', [PostController::class, 'approve'])->whereNumber('id');
        Route::post('/posts/{id}/reject', [PostController::class, 'reject'])->whereNumber('id');
        Route::post('/posts/{id}/save', [PostController::class, 'save'])->whereNumber('id');
        Route::delete('/posts/{id}/save', [PostController::class, 'unsave'])->whereNumber('id');
        Route::post('/posts/{id}/import', [PostController::class, 'import'])->whereNumber('id');

        // Comments (always the viewer's own gender)
        Route::get('/posts/{id}/comments', [CommentController::class, 'index'])->whereNumber('id');
        Route::post('/posts/{id}/comments', [CommentController::class, 'store'])->whereNumber('id');
        Route::put('/comments/{id}', [CommentController::class, 'update'])->whereNumber('id');
        Route::delete('/comments/{id}', [CommentController::class, 'destroy'])->whereNumber('id');

        // Trusted shaykhs and fatwa
        Route::post('/shaykh-requests', [ShaykhController::class, 'requestTrust']);
        Route::get('/shaykh-requests/mine', [ShaykhController::class, 'myRequest']);
        Route::get('/shaykhs', [ShaykhController::class, 'index']);
        Route::get('/shaykhs/{id}', [ShaykhController::class, 'show'])->whereNumber('id');
        Route::get('/fatwas', [ShaykhController::class, 'fatwas']);

        Route::post('/fatwa-questions', [FatwaController::class, 'ask'])->middleware('throttle:10,60');
        Route::get('/fatwa/mine', [FatwaController::class, 'mine']);
        Route::get('/fatwa/inbox', [FatwaController::class, 'inbox']);
        Route::post('/fatwa-questions/{id}/close', [FatwaController::class, 'close'])->whereNumber('id');
        Route::post('/fatwa-questions/{id}/take', [FatwaController::class, 'take'])->whereNumber('id');
        Route::post('/fatwa-questions/{id}/decline', [FatwaController::class, 'declineQuestion'])->whereNumber('id');
        Route::get('/fatwa-threads/{id}', [FatwaController::class, 'thread'])->whereNumber('id');
        Route::post('/fatwa-threads/{id}/messages', [FatwaController::class, 'message'])->whereNumber('id');
        Route::post('/fatwa-threads/{id}/decline', [FatwaController::class, 'decline'])->whereNumber('id');
        Route::post('/fatwa-threads/{id}/refer', [FatwaController::class, 'refer'])->whereNumber('id');
        Route::post('/fatwa-threads/{id}/publish-proposal', [FatwaController::class, 'proposePublish'])->whereNumber('id');
        Route::post('/fatwa-publications/{id}/approve', [FatwaController::class, 'approve'])->whereNumber('id');
        Route::post('/fatwa-publications/{id}/refuse', [FatwaController::class, 'refuse'])->whereNumber('id');

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
        Route::post('/reports', [ReportController::class, 'store'])->middleware('throttle:20,1');
        Route::get('/blocks', [ReportController::class, 'blocks']);
        Route::post('/blocks', [ReportController::class, 'block']);
        Route::delete('/blocks/{id}', [ReportController::class, 'unblock'])->whereNumber('id');
        Route::get('/mutes', [ReportController::class, 'mutes']);
        Route::post('/mutes', [ReportController::class, 'mute']);
        Route::delete('/mutes/{id}', [ReportController::class, 'unmute'])->whereNumber('id');
    });

// Admin routes for community (nested under admin)
// These routes are auto-discovered by the admin module
// Routes: /api/v1/admin/community/*
Route::prefix('admin/community')
    ->middleware(['auth:sanctum', 'abilities:admin', 'active', 'role:'.implode(',', Role::values())])
    ->group(function () {
        Route::get('/space-requests', [SpaceAdminController::class, 'requests']);
        Route::post('/space-requests/{spaceRequest}/approve', [SpaceAdminController::class, 'approve'])->whereNumber('spaceRequest');
        Route::post('/space-requests/{spaceRequest}/reject', [SpaceAdminController::class, 'reject'])->whereNumber('spaceRequest');
        Route::post('/space-requests/{spaceRequest}/request-changes', [SpaceAdminController::class, 'requestChanges'])->whereNumber('spaceRequest');

        Route::get('/shaykh-requests', [ShaykhAdminController::class, 'requests']);
        Route::post('/shaykh-requests/{shaykhRequest}/approve', [ShaykhAdminController::class, 'approve'])->whereNumber('shaykhRequest');
        Route::post('/shaykh-requests/{shaykhRequest}/reject', [ShaykhAdminController::class, 'reject'])->whereNumber('shaykhRequest');
        Route::get('/shaykhs', [ShaykhAdminController::class, 'shaykhs']);
        Route::post('/shaykhs/{shaykh}/withdraw', [ShaykhAdminController::class, 'withdraw'])->whereNumber('shaykh');

        Route::get('/reports', [ReportAdminController::class, 'index']);
        Route::post('/reports/{report}/hide', [ReportAdminController::class, 'hide'])->whereNumber('report');
        Route::post('/reports/{report}/suspend', [ReportAdminController::class, 'suspend'])->whereNumber('report');
        Route::post('/reports/{report}/ban', [ReportAdminController::class, 'ban'])->whereNumber('report');
        Route::post('/reports/{report}/dismiss', [ReportAdminController::class, 'dismiss'])->whereNumber('report');

        Route::get('/members', [MemberController::class, 'index']);
        Route::post('/members/{member}/suspend', [MemberController::class, 'suspend'])->whereNumber('member');
        Route::post('/members/{member}/ban', [MemberController::class, 'ban'])->whereNumber('member');
        Route::post('/members/{member}/reactivate', [MemberController::class, 'reactivate'])->whereNumber('member');
        Route::put('/members/{member}/gender', [MemberController::class, 'changeGender'])->whereNumber('member');

        Route::get('/rules', [RuleController::class, 'index']);
        Route::post('/rules', [RuleController::class, 'store']);
        Route::put('/rules/{rule}', [RuleController::class, 'update'])->whereNumber('rule');
        Route::delete('/rules/{rule}', [RuleController::class, 'destroy'])->whereNumber('rule');

        Route::get('/spaces', [SpaceAdminController::class, 'spaces']);
        Route::post('/spaces/{space}/close', [SpaceAdminController::class, 'close'])->whereNumber('space');
        Route::post('/spaces/{space}/reopen', [SpaceAdminController::class, 'reopen'])->whereNumber('space');
        Route::post('/spaces/{space}/transfer', [SpaceAdminController::class, 'transfer'])->whereNumber('space');
    });
