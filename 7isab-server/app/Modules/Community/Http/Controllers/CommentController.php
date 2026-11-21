<?php

namespace App\Modules\Community\Http\Controllers;

use Illuminate\Http\JsonResponse;

class CommentController
{
    public function index(): JsonResponse { return response()->json([]); }
    public function store(): JsonResponse { return response()->json([]); }
    public function destroy(): JsonResponse { return response()->json([]); }
}
