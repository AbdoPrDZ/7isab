<?php

namespace App\Http\Middleware;

use App\Core\Http\Controller;
use App\Modules\Community\Services\RuleBook;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets through active community members who have accepted every current rule.
 * `is_community_member:pending_rules` also lets through members who still have
 * new or changed rules to accept (to accept them, edit their names or leave).
 */
class EnsureUserIsCommunityMember
{
    public function __construct(private RuleBook $rules) {}

    public function handle(Request $request, Closure $next, ?string $allow = null): Response
    {
        $profile = $request->user()?->communityProfile;

        if (! $profile || $profile->status !== 'active') {
            return Controller::apiErrorResponse(
                'You must be a community member to access this.',
                ['reason' => $profile?->status === 'suspended' || $profile?->status === 'banned' ? $profile->status : 'not_member'],
                403,
            );
        }

        if ($allow !== 'pending_rules' && $this->rules->hasPending($profile)) {
            return Controller::apiErrorResponse('Accept the updated community rules first.', ['reason' => 'rules_pending'], 403);
        }

        return $next($request);
    }
}
