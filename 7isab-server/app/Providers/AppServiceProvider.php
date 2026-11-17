<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Login-type endpoints are limited per email + IP, and per IP overall,
     * to slow down password guessing and email probing.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('auth', function (Request $request): array {
            $email = Str::lower((string) $request->input('email'));

            return [
                Limit::perMinute(5)->by('auth:'.$email.'|'.$request->ip()),
                Limit::perMinute(30)->by('auth-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('recovery', function (Request $request): array {
            $email = Str::lower((string) $request->input('email'));

            return [
                Limit::perHour(10)->by('recovery:'.$email),
                Limit::perHour(30)->by('recovery-ip:'.$request->ip()),
            ];
        });
    }
}
