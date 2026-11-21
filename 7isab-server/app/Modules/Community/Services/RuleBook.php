<?php

namespace App\Modules\Community\Services;

use App\Modules\Community\Models\CommunityProfile;
use App\Modules\Community\Models\CommunityRule;
use App\Modules\Community\Models\RuleAcceptance;
use Illuminate\Support\Collection;

/**
 * The current community rules and who has accepted them.
 * Each rule is accepted on its own; a new version of a rule must be accepted again.
 */
class RuleBook
{
    /** @return Collection<int, CommunityRule> */
    public function current(): Collection
    {
        return CommunityRule::orderBy('order')->orderBy('id')->get();
    }

    /**
     * Current rules the profile hasn't accepted in their current version.
     *
     * @return Collection<int, CommunityRule>
     */
    public function pendingFor(CommunityProfile $profile): Collection
    {
        $accepted = RuleAcceptance::where('profile_id', $profile->id)
            ->get(['rule_key', 'version'])
            ->map(fn (RuleAcceptance $acceptance) => $acceptance->rule_key.'@'.$acceptance->version)
            ->all();

        return $this->current()
            ->reject(fn (CommunityRule $rule) => in_array($rule->key.'@'.$rule->version, $accepted, true))
            ->values();
    }

    public function hasPending(CommunityProfile $profile): bool
    {
        return $this->pendingFor($profile)->isNotEmpty();
    }

    /**
     * Whether the submitted acceptances cover every given rule in its current version.
     *
     * @param  Collection<int, CommunityRule>  $rules
     * @param  list<array{key: string, version: int}>  $acceptances
     */
    public function covers(Collection $rules, array $acceptances): bool
    {
        $submitted = array_map(fn (array $acceptance) => $acceptance['key'].'@'.(int) $acceptance['version'], $acceptances);

        return $rules->every(fn (CommunityRule $rule) => in_array($rule->key.'@'.$rule->version, $submitted, true));
    }

    /** @param  Collection<int, CommunityRule>  $rules */
    public function accept(CommunityProfile $profile, Collection $rules): void
    {
        foreach ($rules as $rule) {
            RuleAcceptance::firstOrCreate(
                ['profile_id' => $profile->id, 'rule_key' => $rule->key, 'version' => $rule->version],
                ['accepted_at' => now()],
            );
        }
    }
}
