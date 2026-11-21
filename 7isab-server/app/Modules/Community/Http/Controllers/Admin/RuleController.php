<?php

namespace App\Modules\Community\Http\Controllers\Admin;

use App\Core\Http\Controller;
use App\Modules\Community\Models\CommunityRule;
use App\Modules\Community\Services\RuleBook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin editor for the community rules. A rule changed in substance gets a new
 * version, which every member must accept again; a wording fix keeps the version.
 */
class RuleController extends Controller
{
    private const TEXT_RULES = [
        'texts' => 'required|array',
        'texts.ar' => 'required|string|max:2000',
        'texts.en' => 'required|string|max:2000',
        'texts.fr' => 'required|string|max:2000',
    ];

    public function index(RuleBook $rules): JsonResponse
    {
        return self::apiSuccessResponse('Rules', ['items' => $rules->current()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:64|regex:/^[a-z0-9_]+$/|unique:community_rules,key',
            'order' => 'nullable|integer|min:0',
            ...self::TEXT_RULES,
        ]);

        $rule = CommunityRule::create([
            'key' => $validated['key'],
            'version' => 1,
            'order' => $validated['order'] ?? ((int) CommunityRule::max('order') + 1),
            'texts' => $this->texts($validated['texts']),
        ]);

        return self::apiSuccessResponse('Rule created', ['item' => $rule], 201);
    }

    public function update(Request $request, CommunityRule $rule): JsonResponse
    {
        $validated = $request->validate([
            'order' => 'nullable|integer|min:0',
            'changed' => 'required|boolean',
            ...self::TEXT_RULES,
        ]);

        $rule->fill([
            'texts' => $this->texts($validated['texts']),
            'order' => $validated['order'] ?? $rule->order,
        ]);

        if ($validated['changed']) {
            $rule->version++;
        }

        $rule->save();

        return self::apiSuccessResponse('Rule updated', ['item' => $rule]);
    }

    /** Removing a rule never asks members to accept anything. */
    public function destroy(CommunityRule $rule): JsonResponse
    {
        $rule->delete();

        return self::apiSuccessResponse('Rule deleted');
    }

    /**
     * @param  array<string, string>  $texts
     * @return array{ar: string, en: string, fr: string}
     */
    private function texts(array $texts): array
    {
        return ['ar' => trim($texts['ar']), 'en' => trim($texts['en']), 'fr' => trim($texts['fr'])];
    }
}
