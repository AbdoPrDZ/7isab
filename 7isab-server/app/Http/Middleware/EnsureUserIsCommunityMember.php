<?php

namespace App\Http\Middleware;

use App\Core\Http\Controller;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects requests from non-community members.
 */
class EnsureUserIsCommunityMember
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && (!$user->communityProfile || $user->communityProfile->status !== 'active')) {
            return Controller::apiErrorResponse('You must be a community member to access this.', code: 403);
        }

        return $next($request);
    }
}
