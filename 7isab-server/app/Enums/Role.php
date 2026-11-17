<?php

namespace App\Enums;

/**
 * Admin-panel roles (Spatie). App users have no role.
 * No role grants access to user data: the server only holds ciphertext.
 */
enum Role: string
{
    /** Full panel access, including managing other admins. */
    case SuperAdmin = 'super-admin';

    /** Manages app users (list, disable, delete, sign out). */
    case Admin = 'admin';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
