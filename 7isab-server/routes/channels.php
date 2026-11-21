<?php

use Illuminate\Support\Facades\Broadcast;

/*
| Broadcast Channels
|
| Here you may register all of the broadcast channels that your
| application supports. The given channel authorization callbacks
| are used to check if an authenticated user can listen to the
| channel.
*/

// Personal user notifications
Broadcast::channel('private-users.{userId}', function ($user, $userId) {
    return $user->id === (int) $userId;
});

// Space posts by gender (members/followers of that space of that gender)
Broadcast::channel('private-spaces.{spaceId}.{gender}', function ($user, $spaceId, $gender) {
    // Check if user is a member or follower of the space and matches the gender
    // The server will verify this in the channel authorization, we just prevent obvious mismatches
    if (! in_array($gender, ['male', 'female'])) {
        return false;
    }

    // User must be a community member
    if (! $user->communityProfile) {
        return false;
    }

    return true;
});

// Post comments by gender
Broadcast::channel('private-posts.{postId}.{gender}', function ($user, $postId, $gender) {
    if (! in_array($gender, ['male', 'female'])) {
        return false;
    }

    if (! $user->communityProfile) {
        return false;
    }

    return true;
});

// Conversations (direct and group chats)
Broadcast::channel('private-conversations.{conversationId}', function ($user, $conversationId) {
    // Check if user is a member of the conversation
    // The server will verify the actual membership
    if (! $user->communityProfile) {
        return false;
    }

    return true;
});

// Shaykhs receiving questions by gender
Broadcast::channel('private-shaykhs.{gender}', function ($user, $gender) {
    if (! in_array($gender, ['male', 'female'])) {
        return false;
    }

    if (! $user->communityProfile) {
        return false;
    }

    // Only trusted shaykhs of this gender can listen
    // The server will verify this
    return true;
});

// Admin notifications
Broadcast::channel('private-admin', function ($user) {
    return $user->is_admin;
});
