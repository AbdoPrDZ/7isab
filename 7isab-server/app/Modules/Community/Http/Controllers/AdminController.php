<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Space;
use App\Modules\Community\Models\SpaceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function spaceRequests(Request $request): JsonResponse
    {
        $requests = SpaceRequest::where('status', 'pending')
            ->with('requester')
            ->paginate(20);

        return response()->json(['requests' => $requests]);
    }

    public function approveSpaceRequest(Request $request, int $id): JsonResponse
    {
        $spaceRequest = SpaceRequest::findOrFail($id);

        if ($spaceRequest->status !== 'pending') {
            return Controller::apiErrorResponse('Cannot approve non-pending request', code: 400);
        }

        $baseSlug = Str::slug($spaceRequest->name);
        $space = Space::create([
            'type' => $spaceRequest->type,
            'name' => $spaceRequest->name,
            'slug' => $baseSlug.'-'.uniqid(),
            'purpose' => $spaceRequest->purpose,
            'goals' => $spaceRequest->goals,
            'content_plan' => $spaceRequest->content_plan,
            'owner_id' => $spaceRequest->requester_id,
            'gender' => $spaceRequest->audience === 'gender' ? $spaceRequest->requester->gender : null,
            'join_policy' => $spaceRequest->join_policy ?? 'open',
            'status' => 'active',
        ]);

        $spaceRequest->update([
            'status' => 'approved',
            'reviewed_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Space created', 'space_id' => $space->id]);
    }

    public function rejectSpaceRequest(Request $request, int $id): JsonResponse
    {
        $spaceRequest = SpaceRequest::findOrFail($id);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $spaceRequest->update([
            'status' => 'rejected',
            'admin_note' => $validated['reason'],
            'reviewed_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Request rejected']);
    }

    public function requestChanges(Request $request, int $id): JsonResponse
    {
        $spaceRequest = SpaceRequest::findOrFail($id);

        $validated = $request->validate([
            'changes_needed' => 'required|string|max:500',
        ]);

        $spaceRequest->update([
            'status' => 'changes_requested',
            'admin_note' => $validated['changes_needed'],
        ]);

        return response()->json(['message' => 'Changes requested']);
    }

    public function shaiekhRequests(): JsonResponse
    {
        return response()->json([]);
    }

    public function approveShaiekhRequest(): JsonResponse
    {
        return response()->json([]);
    }

    public function rejectShaiekhRequest(): JsonResponse
    {
        return response()->json([]);
    }

    public function reports(): JsonResponse
    {
        return response()->json([]);
    }

    public function hideContent(): JsonResponse
    {
        return response()->json([]);
    }

    public function warnUser(): JsonResponse
    {
        return response()->json([]);
    }

    public function suspendUser(): JsonResponse
    {
        return response()->json([]);
    }

    public function banUser(): JsonResponse
    {
        return response()->json([]);
    }

    public function spaces(): JsonResponse
    {
        return response()->json([]);
    }

    public function closeSpace(): JsonResponse
    {
        return response()->json([]);
    }

    public function transferSpace(): JsonResponse
    {
        return response()->json([]);
    }
}
