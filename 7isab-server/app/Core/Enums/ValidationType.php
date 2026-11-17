<?php

namespace App\Core\Enums;

/**
 * Which validation rule set a model should return.
 */
enum ValidationType: string
{
    case Create = 'create';
    case Update = 'update';
}
