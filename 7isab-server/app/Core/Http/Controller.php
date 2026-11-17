<?php

namespace App\Core\Http;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;

/**
 * Base controller for every module.
 *
 * Every API response uses the same JSON envelope:
 * { "success": bool, "message": string, ...data }
 */
abstract class Controller extends BaseController
{
    use AuthorizesRequests;

    public static function apiResponse(bool $success, string $message, array $data = [], int $code = 200): JsonResponse
    {
        return response()->json([
            'success' => $success,
            'message' => $message,
            ...$data,
        ], $code);
    }

    public static function apiSuccessResponse(string $message, array $data = [], int $code = 200): JsonResponse
    {
        return self::apiResponse(true, $message, $data, $code);
    }

    public static function apiErrorResponse(string $message, array $data = [], int $code = 400): JsonResponse
    {
        return self::apiResponse(false, $message, $data, $code);
    }

    /**
     * Validation failure: each field keeps only its first message.
     * With a single error and no explicit message, that error becomes the message.
     */
    public static function apiInvalidValuesResponse(array $errors = [], ?string $message = null, array $data = [], int $code = 422): JsonResponse
    {
        foreach ($errors as $key => $value) {
            if (is_array($value)) {
                $errors[$key] = $value[0] ?? '';
            }
        }

        if (! $message && count($errors) === 1) {
            $message = array_values($errors)[0];
        }

        return self::apiErrorResponse($message ?? 'Invalid values', [
            ...$data,
            'errors' => $errors,
        ], $code);
    }

    public static function apiSingleErrorResponse(string $field, string $message, array $data = [], int $code = 422): JsonResponse
    {
        return self::apiInvalidValuesResponse([$field => $message], $message, $data, $code);
    }
}
