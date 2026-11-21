<?php

namespace App\Modules\Community\Http\Controllers;

use Illuminate\Http\JsonResponse;

class ShaiekhController
{
    public function requestTrust(): JsonResponse { return response()->json([]); }
    public function index(): JsonResponse { return response()->json([]); }
    public function askQuestion(): JsonResponse { return response()->json([]); }
    public function myQuestions(): JsonResponse { return response()->json([]); }
    public function publishedFatwas(): JsonResponse { return response()->json([]); }
    public function proposePublish(): JsonResponse { return response()->json([]); }
    public function approveFatwa(): JsonResponse { return response()->json([]); }
    public function refuseFatwa(): JsonResponse { return response()->json([]); }
}
