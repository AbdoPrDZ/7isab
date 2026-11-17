<?php

namespace App\Core\Models\Concerns;

use App\Core\Http\Controller;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Server-side table pipeline for list endpoints:
 * validate → joins → sort → search/filter → paginate → load → map.
 *
 * Model config (all optional):
 * - $sortable     fields allowed in ?sort[field]=asc|desc (fallback: $fillable)
 * - $filterable   fields matched by ?search= and ?filter[field]=
 * - $tablingRules extra validation rules
 * Keys may be numeric (column) or associative ('publicName' => 'db.column').
 *
 * Response: { success, message, items, itemsCount, pagesCount, page }
 */
trait Tabling
{
    public const TABLING_MAX_PAGE_SIZE = 500;

    /**
     * Reads an optional config property declared on the model.
     * Checked with property_exists so Eloquent never treats the name as an attribute or relation.
     */
    private function tablingProperty(string $name): ?array
    {
        return property_exists($this, $name) ? $this->{$name} : null;
    }

    protected function tablingSortFields(): array
    {
        return $this->tablingProperty('sortable') ?? $this->getFillable();
    }

    protected function tablingFilterFields(): array
    {
        return $this->tablingProperty('filterable') ?? [];
    }

    /** Normalizes ['a', 'b' => 'x.b'] into ['a' => 'a', 'b' => 'x.b']. */
    private static function tablingColumns(array $fields): array
    {
        $columns = [];
        foreach ($fields as $key => $value) {
            $columns[is_numeric($key) ? $value : $key] = $value;
        }

        return $columns;
    }

    private function buildTablingRules(array $sortable, array $filterable): array
    {
        $rules = [
            'page' => 'required|integer|min:1',
            'pageSize' => 'nullable|integer|min:1|max:'.self::TABLING_MAX_PAGE_SIZE,
            'search' => 'nullable|string|max:255',
            'sort' => 'nullable|array',
            'filter' => 'nullable|array',
        ];

        foreach (array_keys($sortable) as $field) {
            $rules["sort.$field"] = 'nullable|in:asc,desc';
        }

        foreach (array_keys($filterable) as $field) {
            $rules["filter.$field"] = 'nullable|string|max:255';
        }

        return array_merge($rules, $this->tablingProperty('tablingRules') ?? []);
    }

    /**
     * Merges eager-loaded relations into a hand-built toArray() result,
     * so custom serializers don't drop loaded relations.
     */
    public function mergeArrayableRelations(array $data): array
    {
        foreach ($this->getArrayableRelations() as $key => $value) {
            $data[$key] = $value instanceof Arrayable ? $value->toArray() : $value;
        }

        return $data;
    }

    /**
     * @param  string|array  $relations  belongsTo relations to left-join (aliased by relation name)
     * @param  string|array  $load  relations to eager-load on the page's items
     * @param  array  $joins  extra [table, first, operator, second] left joins
     * @param  array  $rawSelects  selectRaw expressions, optionally 'alias' => 'expr'
     * @param  array  $sortables  extra sortable fields for this call
     * @param  array  $filters  extra filterable fields for this call
     */
    public static function tablingCollect(
        Request $request,
        string|array $relations = [],
        string|array $load = [],
        QueryBuilder|EloquentBuilder|null $query = null,
        array $joins = [],
        string|array|null $selects = null,
        array $rawSelects = [],
        ?callable $map = null,
        array $sortables = [],
        array $filters = [],
    ): JsonResponse {
        $model = new static;

        $sortable = self::tablingColumns(array_merge($model->tablingSortFields(), $sortables));
        $filterable = self::tablingColumns(array_merge($model->tablingFilterFields(), $filters));

        $request->mergeIfMissing(['page' => 1]);

        $validation = Validator::make($request->all(), $model->buildTablingRules($sortable, $filterable));
        if ($validation->fails()) {
            return Controller::apiInvalidValuesResponse($validation->errors()->toArray());
        }

        $unknown = [];
        foreach (['sort' => $sortable, 'filter' => $filterable] as $param => $allowed) {
            foreach (array_diff(array_keys((array) $request->input($param, [])), array_keys($allowed)) as $field) {
                $unknown["$param.$field"] = "Unknown $param field: $field.";
            }
        }
        if ($unknown) {
            return Controller::apiInvalidValuesResponse($unknown);
        }

        $query ??= static::query();

        foreach ((array) $relations as $name) {
            /** @var BelongsTo $relation */
            $relation = $model->{$name}();
            $query->leftJoin(
                $relation->getRelated()->getTable().' as '.$name,
                $name.'.'.$relation->getOwnerKeyName(),
                '=',
                $relation->getQualifiedForeignKeyName(),
            );
        }

        foreach ($joins as $join) {
            $query->leftJoin(...$join);
        }

        foreach ((array) $request->input('sort', []) as $field => $direction) {
            if (isset($sortable[$field]) && in_array($direction, ['asc', 'desc'], true)) {
                $query->orderBy($sortable[$field], $direction);
            }
        }

        $search = $request->input('search');
        $filter = (array) $request->input('filter', []);
        $like = $query->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        if ($search) {
            $query->where(function ($q) use ($filterable, $search, $like) {
                foreach ($filterable as $column) {
                    $q->orWhere($column, $like, '%'.$search.'%');
                }
            });
        } else {
            foreach ($filter as $field => $value) {
                if (isset($filterable[$field]) && $value !== null && $value !== '') {
                    $query->where($filterable[$field], $like, '%'.$value.'%');
                }
            }
        }

        $query->select($selects ?? $model->getTable().'.*');
        foreach ($rawSelects as $alias => $expression) {
            $query->selectRaw($expression.(is_string($alias) ? " as $alias" : ''));
        }

        $pageSize = (int) ($request->input('pageSize') ?? 25);
        $paginate = $query->paginate($pageSize, page: (int) $request->input('page'));

        $items = collect($paginate->items());
        if ($load && $items->isNotEmpty() && $items->first() instanceof Model) {
            $paginate->getCollection()->load($load);
        }
        if ($map) {
            $items = $items->map($map);
        }

        return Controller::apiSuccessResponse('Items retrieved successfully', [
            'items' => $items->values(),
            'itemsCount' => $paginate->total(),
            'pagesCount' => $paginate->lastPage(),
            'page' => min($paginate->currentPage(), max($paginate->lastPage(), 1)),
        ]);
    }
}
