<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\CommunityRule;
use App\Modules\Community\Models\RuleAcceptance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JoinController extends Controller
{
    public function rules(): JsonResponse
    {
        $rules = CommunityRule::orderBy('order')->get()->map(fn ($r) => [
            'key' => $r->key,
            'version' => $r->version,
            'texts' => $r->texts,
        ]);

        return response()->json(['rules' => $rules]);
    }

    public function join(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->communityProfile) {
            return Controller::apiErrorResponse('Already a community member', code: 409);
        }

        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'gender' => 'required|in:male,female',
            'rule_acceptances' => 'required|array|min:1',
            'rule_acceptances.*.key' => 'required|string',
            'rule_acceptances.*.version' => 'required|integer',
        ]);

        $profile = CommunityProfile::create([
            'user_id' => $user->id,
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'gender' => $validated['gender'],
            'status' => 'active',
            'joined_at' => now(),
        ]);

        foreach ($validated['rule_acceptances'] as $acceptance) {
            RuleAcceptance::create([
                'profile_id' => $profile->id,
                'rule_key' => $acceptance['key'],
                'version' => $acceptance['version'],
                'accepted_at' => now(),
            ]);
        }

        return response()->json(['profile' => [
            'id' => $profile->id,
            'first_name' => $profile->first_name,
            'last_name' => $profile->last_name,
            'gender' => $profile->gender,
            'joined_at' => $profile->joined_at,
        ]], 201);
    }

    public function leave(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        if (!$profile) {
            return Controller::apiErrorResponse('Not a community member', code: 404);
        }

        $profile->update(['status' => 'left']);

        return response()->json(['message' => 'Left community']);
    }

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        if (!$profile || $profile->status !== 'active') {
            return Controller::apiErrorResponse('Not a community member', code: 404);
        }

        return response()->json([
            'id' => $profile->id,
            'first_name' => $profile->first_name,
            'last_name' => $profile->last_name,
            'gender' => $profile->gender,
            'joined_at' => $profile->joined_at,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user->communityProfile;

        if (!$profile) {
            return Controller::apiErrorResponse('Not a community member', code: 404);
        }

        $validated = $request->validate([
            'first_name' => 'sometimes|required|string|max:100',
            'last_name' => 'sometimes|required|string|max:100',
        ]);

        $profile->update($validated);

        return response()->json(['profile' => [
            'id' => $profile->id,
            'first_name' => $profile->first_name,
            'last_name' => $profile->last_name,
            'gender' => $profile->gender,
        ]]);
    }
}
