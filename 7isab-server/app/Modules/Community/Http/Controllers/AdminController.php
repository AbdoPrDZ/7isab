<?php

namespace App\Modules\Community\Http\Controllers;

use Illuminate\Http\JsonResponse;

class AdminController
{
    public function spaceRequests(): JsonResponse { return response()->json([]); }
    public function approveSpaceRequest(): JsonResponse { return response()->json([]); }
    public function rejectSpaceRequest(): JsonResponse { return response()->json([]); }
    public function requestChanges(): JsonResponse { return response()->json([]); }
    public function shaiekhRequests(): JsonResponse { return response()->json([]); }
    public function approveShaiekhRequest(): JsonResponse { return response()->json([]); }
    public function rejectShaiekhRequest(): JsonResponse { return response()->json([]); }
    public function reports(): JsonResponse { return response()->json([]); }
    public function hideContent(): JsonResponse { return response()->json([]); }
    public function warnUser(): JsonResponse { return response()->json([]); }
    public function suspendUser(): JsonResponse { return response()->json([]); }
    public function banUser(): JsonResponse { return response()->json([]); }
    public function members(): JsonResponse { return response()->json([]); }
    public function suspendMember(): JsonResponse { return response()->json([]); }
    public function banMember(): JsonResponse { return response()->json([]); }
    public function changeGender(): JsonResponse { return response()->json([]); }
    public function rules(): JsonResponse { return response()->json([]); }
    public function updateRule(): JsonResponse { return response()->json([]); }
    public function spaces(): JsonResponse { return response()->json([]); }
    public function closeSpace(): JsonResponse { return response()->json([]); }
    public function transferSpace(): JsonResponse { return response()->json([]); }
}
