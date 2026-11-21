<?php

namespace App\Modules\Community\Http\Controllers;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\CommunityRule;
use App\Modules\Community\Services\RuleBook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Joining, rule acceptance, the member's own profile, and leaving.
 * Joining is optional: nothing is stored until the user joins.
 */
class JoinController extends Controller
{
    public function __construct(private RuleBook $rules) {}

    public function rules(): JsonResponse
    {
        return self::apiSuccessResponse('Rules', [
            'rules' => $this->rules->current()->map(fn (CommunityRule $rule) => $this->ruleData($rule))->values(),
        ]);
    }

    /**
     * Where the user stands: no profile, a member (with any rules to accept again),
     * left, suspended or banned. Open to every signed-in user.
     */
    public function status(Request $request): JsonResponse
    {
        $profile = $request->user()->communityProfile;

        return self::apiSuccessResponse('Membership', [
            'profile' => $profile ? $this->profileData($profile) : null,
            'pending_rules' => $profile && $profile->status === 'active'
                ? $this->rules->pendingFor($profile)->map(fn (CommunityRule $rule) => $this->ruleData($rule))->values()
                : [],
        ]);
    }

    public function join(Request $request): JsonResponse
    {
        $profile = $request->user()->communityProfile;

        if ($profile?->status === 'active') {
            return self::apiErrorResponse('Already a community member', ['reason' => 'already_member'], 409);
        }

        if ($profile && in_array($profile->status, ['suspended', 'banned'], true)) {
            return self::apiErrorResponse('This community account is '.$profile->status, ['reason' => $profile->status], 403);
        }

        // Gender is set once: someone rejoining keeps it.
        $rejoining = $profile !== null;

        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'gender' => $rejoining ? 'prohibited' : 'required|in:male,female',
            'rule_acceptances' => 'present|array',
            'rule_acceptances.*.key' => 'required|string',
            'rule_acceptances.*.version' => 'required|integer',
        ]);

        $current = $this->rules->current();

        if ($current->isEmpty()) {
            return self::apiErrorResponse('The community rules are not available yet', ['reason' => 'no_rules'], 503);
        }

        if (! $this->rules->covers($current, $validated['rule_acceptances'])) {
            return self::apiSingleErrorResponse('rule_acceptances', 'Every community rule must be accepted in its current version.');
        }

        $profile = DB::transaction(function () use ($request, $profile, $validated, $current) {
            $profile ??= new CommunityProfile([
                'user_id' => $request->user()->id,
                'gender' => $validated['gender'],
            ]);

            $profile->fill([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'status' => 'active',
                'joined_at' => now(),
            ])->save();

            $this->rules->accept($profile, $current);

            return $profile;
        });

        return self::apiSuccessResponse('Joined the community', ['profile' => $this->profileData($profile)], $rejoining ? 200 : 201);
    }

    /** Accepting new or changed rules, so an existing member can keep taking part. */
    public function acceptRules(Request $request): JsonResponse
    {
        $profile = $request->user()->communityProfile;

        $validated = $request->validate([
            'rule_acceptances' => 'required|array',
            'rule_acceptances.*.key' => 'required|string',
            'rule_acceptances.*.version' => 'required|integer',
        ]);

        $pending = $this->rules->pendingFor($profile);

        if (! $this->rules->covers($pending, $validated['rule_acceptances'])) {
            return self::apiSingleErrorResponse('rule_acceptances', 'Every new or changed rule must be accepted.');
        }

        $this->rules->accept($profile, $pending);

        return self::apiSuccessResponse('Rules accepted', ['profile' => $this->profileData($profile)]);
    }

    public function leave(Request $request): JsonResponse
    {
        $profile = $request->user()->communityProfile;
        $profile->update(['status' => 'left']);

        return self::apiSuccessResponse('Left the community');
    }

    /** Names only: gender is changed by an admin. */
    public function updateProfile(Request $request): JsonResponse
    {
        $profile = $request->user()->communityProfile;

        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
        ]);

        $profile->update($validated);

        return self::apiSuccessResponse('Profile updated', ['profile' => $this->profileData($profile)]);
    }

    /** @return array<string, mixed> */
    private function profileData(CommunityProfile $profile): array
    {
        return [
            'id' => $profile->id,
            'first_name' => $profile->first_name,
            'last_name' => $profile->last_name,
            'gender' => $profile->gender,
            'status' => $profile->status,
            'joined_at' => $profile->joined_at,
        ];
    }

    /** @return array{key: string, version: int, texts: array<string, string>} */
    private function ruleData(CommunityRule $rule): array
    {
        return ['key' => $rule->key, 'version' => $rule->version, 'texts' => $rule->texts];
    }
}
