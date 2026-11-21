<?php

namespace App\Modules\Community\Http\Controllers;

use Illuminate\Http\JsonResponse;

class ChatController
{
    public function uploadKey(): JsonResponse { return response()->json([]); }
    public function getKey(): JsonResponse { return response()->json([]); }
    public function createConversation(): JsonResponse { return response()->json([]); }
    public function listConversations(): JsonResponse { return response()->json([]); }
    public function messages(): JsonResponse { return response()->json([]); }
    public function sendMessage(): JsonResponse { return response()->json([]); }
    public function addReaction(): JsonResponse { return response()->json([]); }
    public function removeReaction(): JsonResponse { return response()->json([]); }
}
