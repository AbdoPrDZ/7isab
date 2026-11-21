<?php

namespace App\Modules\Community\Http\Controllers;

use Illuminate\Http\JsonResponse;

class SpaceController
{
    public function discover(): JsonResponse { return response()->json([]); }
    public function show(): JsonResponse { return response()->json([]); }
    public function join(): JsonResponse { return response()->json([]); }
    public function leave(): JsonResponse { return response()->json([]); }
    public function follow(): JsonResponse { return response()->json([]); }
    public function unfollow(): JsonResponse { return response()->json([]); }
    public function requestCreation(): JsonResponse { return response()->json([]); }
    public function myRequests(): JsonResponse { return response()->json([]); }
}
