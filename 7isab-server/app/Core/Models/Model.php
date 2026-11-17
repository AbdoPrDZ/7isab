<?php

namespace App\Core\Models;

use App\Core\Enums\ValidationType;
use App\Core\Models\Concerns\Tabling;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model as EloquentModel;

/**
 * Base model for every resource.
 *
 * Validation rules live on the model (see validationRules), and list
 * endpoints use the Tabling pipeline (Model::tablingCollect).
 * Soft deletes are opt-in per model.
 */
abstract class Model extends EloquentModel
{
    use HasFactory, Tabling;

    /**
     * Validation rules for creating or updating this model.
     *
     * @return array<string, mixed>
     */
    public static function validationRules(ValidationType $type, ?EloquentModel $record = null): array
    {
        throw new \BadMethodCallException(static::class.'::validationRules() is not implemented');
    }
}
