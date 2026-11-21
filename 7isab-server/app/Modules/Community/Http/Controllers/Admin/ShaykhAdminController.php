<?php

namespace App\Modules\Community\Http\Controllers\Admin;

use App\Core\Http\Controller;
use App\Modules\Community\Models\Shaykh;
use App\Modules\Community\Models\ShaykhRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Admin review of trust requests, and the trusted shaykhs (trust can be withdrawn). */
class ShaykhAdminController extends Controller
{
    public function requests(Request $request): JsonResponse
    {
        $validated = $request->validate(['status' => 'nullable|in:pending,approved,rejected']);

        $items = ShaykhRequest::where('status', $validated['status'] ?? 'pending')
            ->with('profile:id,first_name,last_name,gender,status')
            ->oldest()
            ->limit(200)
            ->get();

        return self::apiSuccessResponse('Requests', ['items' => $items]);
    }

    /** Grants trust with the request's details (restoring a withdrawn shaykh's record). */
    public function approve(ShaykhRequest $shaykhRequest): JsonResponse
    {
        if ($shaykhRequest->status !== 'pending') {
            return self::apiErrorResponse('Only a pending request can be approved', code: 409);
        }

        $shaykh = DB::transaction(function () use ($shaykhRequest) {
            $shaykh = Shaykh::updateOrCreate(
                ['profile_id' => $shaykhRequest->profile_id],
                [...$shaykhRequest->only(ShaykhRequest::FIELDS), 'trusted_at' => now(), 'withdrawn_at' => null],
            );
            $shaykhRequest->update(['status' => 'approved', 'admin_note' => null]);

            return $shaykh;
        });

        return self::apiSuccessResponse('Trust granted', ['item' => $shaykh], 201);
    }

    public function reject(Request $request, ShaykhRequest $shaykhRequest): JsonResponse
    {
        if ($shaykhRequest->status !== 'pending') {
            return self::apiErrorResponse('Only a pending request can be rejected', code: 409);
        }

        $validated = $request->validate(['note' => 'required|string|max:1000']);
        $shaykhRequest->update(['status' => 'rejected', 'admin_note' => $validated['note']]);

        return self::apiSuccessResponse('Request rejected', ['item' => $shaykhRequest]);
    }

    public function shaykhs(): JsonResponse
    {
        $items = Shaykh::with('profile:id,first_name,last_name,gender,status')
            ->orderByRaw('withdrawn_at is not null')
            ->latest('trusted_at')
            ->limit(500)
            ->get();

        return self::apiSuccessResponse('Shaykhs', ['items' => $items]);
    }

    /** Withdraws trust: the shaykh can't answer, and their profile and fatwas are no longer shown. */
    public function withdraw(Shaykh $shaykh): JsonResponse
    {
        $shaykh->update(['withdrawn_at' => now()]);
        ShaykhRequest::where('profile_id', $shaykh->profile_id)->update(['status' => 'rejected', 'admin_note' => 'Trust withdrawn']);

        return self::apiSuccessResponse('Trust withdrawn', ['item' => $shaykh]);
    }
}
