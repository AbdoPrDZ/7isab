<?php

namespace App\Http\Middleware;

use App\Core\Http\Controller;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Requires one of the given admin roles.
 *
 * Usage: role:super-admin,admin
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return Controller::apiErrorResponse('Unauthenticated.', code: 401);
        }

        if (! $user->hasAnyRole($roles)) {
            return Controller::apiErrorResponse('Forbidden.', code: 403);
        }

        return $next($request);
    }
}
