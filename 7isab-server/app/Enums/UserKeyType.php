<?php

namespace App\Enums;

enum UserKeyType: string
{
    /** Data key locked with the key derived from the account password. */
    case Password = 'password';

    /** Data key locked with the key derived from the recovery key. */
    case Recovery = 'recovery';
}
