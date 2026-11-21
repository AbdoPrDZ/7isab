<?php

namespace App\Modules\Community\Http\Controllers;

use Illuminate\Http\JsonResponse;

class PostController
{
    public function feed(): JsonResponse { return response()->json([]); }
    public function spacePosts(): JsonResponse { return response()->json([]); }
    public function store(): JsonResponse { return response()->json([]); }
    public function update(): JsonResponse { return response()->json([]); }
    public function destroy(): JsonResponse { return response()->json([]); }
    public function save(): JsonResponse { return response()->json([]); }
    public function import(): JsonResponse { return response()->json([]); }
}
