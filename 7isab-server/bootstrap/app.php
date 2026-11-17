<?php

use App\Core\Http\Controller;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        __DIR__.'/../app/Modules/Quran/Console',
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        if ($trusted = env('TRUSTED_PROXIES')) {
            $middleware->trustProxies(at: $trusted === '*' ? '*' : array_map('trim', explode(',', $trusted)));
        }

        $middleware->alias([
            'abilities' => CheckAbilities::class,
            'ability' => CheckForAnyAbility::class,
            'active' => EnsureUserIsActive::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $isApi = fn (Request $request): bool => $request->is('api/*') || $request->expectsJson();

        $exceptions->shouldRenderJsonWhen($isApi);

        // Every API error uses the same envelope as successful responses.
        $exceptions->render(function (ValidationException $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiInvalidValuesResponse($e->errors(), code: 422) : null;
        });
        $exceptions->render(function (AuthenticationException $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiErrorResponse('Unauthenticated.', code: 401) : null;
        });
        $exceptions->render(function (AuthorizationException $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiErrorResponse('Forbidden.', code: 403) : null;
        });
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiErrorResponse('Too many attempts. Try again later.', code: 429)->withHeaders($e->getHeaders()) : null;
        });
        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiErrorResponse('Not found.', code: 404) : null;
        });
        $exceptions->render(function (ModelNotFoundException $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiErrorResponse('Not found.', code: 404) : null;
        });
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($isApi) {
            return $isApi($request) ? Controller::apiErrorResponse($e->getMessage() ?: 'Request failed.', code: $e->getStatusCode()) : null;
        });
    })->create();
