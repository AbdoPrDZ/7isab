<?php

namespace App\Http\Middleware;

use App\Core\Http\Controller;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects requests from disabled accounts, even with a still-valid token.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            return Controller::apiErrorResponse('This account is disabled.', code: 403);
        }

        return $next($request);
    }
}
