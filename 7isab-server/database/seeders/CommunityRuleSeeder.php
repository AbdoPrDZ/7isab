<?php

namespace Database\Seeders;

use App\Modules\Community\Models\CommunityRule;
use Illuminate\Database\Seeder;

/**
 * The starting community rules (from the community blueprint). Only missing
 * rules are created, so admin edits are never overwritten.
 */
class CommunityRuleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (self::RULES as $order => [$key, $texts]) {
            CommunityRule::firstOrCreate(['key' => $key], ['version' => 1, 'order' => $order, 'texts' => $texts]);
        }
    }

    /** @var list<array{0: string, 1: array{ar: string, en: string, fr: string}}> */
    private const RULES = [
        ['no_fitna', [
            'ar' => 'لا فتنة ولا تكفير: لا تُكفّر أحدًا، ولا تنشر ما يثير الفتنة بين المسلمين.',
            'en' => 'No fitna and no takfir: never declare anyone a disbeliever, and never spread what stirs up discord among Muslims.',
            'fr' => 'Ni fitna ni takfir : ne déclarez jamais quelqu\'un mécréant et ne diffusez rien qui sème la discorde entre musulmans.',
        ]],
        ['no_sectarian_disputes', [
            'ar' => 'لا نزاعات طائفية أو مذهبية: يُحترم اختلاف العلماء، ولا مكان للجدال والتعصب.',
            'en' => 'No sectarian disputes: the scholars\' differences are respected, and there is no place for quarrels or partisanship.',
            'fr' => 'Pas de querelles sectaires : les divergences des savants sont respectées, et il n\'y a pas de place pour les disputes ou le fanatisme.',
        ]],
        ['no_haram_content', [
            'ar' => 'لا محتوى محرّمًا: لا كلام ولا روابط لما حرّم الله.',
            'en' => 'No haram content: no words or links to what Allah has forbidden.',
            'fr' => 'Aucun contenu haram : ni propos ni liens vers ce qu\'Allah a interdit.',
        ]],
        ['hadith_with_source', [
            'ar' => 'كل حديث بمصدره: اذكر من رواه، ولا تنشر حديثًا لا تعرف صحته.',
            'en' => 'Every hadith with its source: say who narrated it, and never share a hadith whose authenticity you don\'t know.',
            'fr' => 'Chaque hadith avec sa source : indiquez qui l\'a rapporté, et ne partagez jamais un hadith dont vous ignorez l\'authenticité.',
        ]],
        ['no_selling_or_ads', [
            'ar' => 'لا بيع ولا إعلانات: المجتمع للنفع لا للتجارة.',
            'en' => 'No selling and no ads: the community is for benefit, not for trade.',
            'fr' => 'Ni vente ni publicité : la communauté est faite pour le bien, pas pour le commerce.',
        ]],
        ['stay_on_purpose', [
            'ar' => 'التزم بغرض المساحة: انشر في كل مجموعة أو صفحة ما يناسب هدفها.',
            'en' => 'Stay within the space\'s purpose: in each group or page, share what fits its goal.',
            'fr' => 'Restez dans le but de l\'espace : dans chaque groupe ou page, partagez ce qui correspond à son objectif.',
        ]],
    ];
}
