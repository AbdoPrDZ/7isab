import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FilterBar } from '@/components/stats/filter-bar';
import { AkhiraSection, DeedsSection, DunyaSection, EntriesSection, OverviewSection } from '@/components/stats/sections';
import { usePanel } from '@/components/stats/use-panel';
import { Chips, Screen } from '@/components/ui/layout';
import { EMPTY_FILTER, type StatsFilter } from '@/lib/stats/filter';

type StatsSection = 'overview' | 'dunya' | 'akhira' | 'deeds' | 'entries';
const SECTIONS: StatsSection[] = ['overview', 'dunya', 'akhira', 'deeds', 'entries'];

function isSection(value: unknown): value is StatsSection {
  return typeof value === 'string' && (SECTIONS as string[]).includes(value);
}

/** Statistics: one filter bar (period, comparison, filters, saved filters) over five sections. */
export default function StatsTab() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ section?: string; account?: string }>();
  const [section, setSection] = useState<StatsSection>(isSection(params.section) ? params.section : 'overview');
  const [filter, setFilter] = useState<StatsFilter>(
    params.account ? { ...EMPTY_FILTER, accounts: [params.account] } : EMPTY_FILTER,
  );
  const panel = usePanel(filter);

  // Opening the tab again from a link (an account, a balance) applies its section / account.
  const [linked, setLinked] = useState({ section: params.section, account: params.account });
  if (linked.section !== params.section || linked.account !== params.account) {
    setLinked({ section: params.section, account: params.account });
    if (isSection(params.section)) setSection(params.section);
    if (params.account) setFilter((current) => ({ ...current, accounts: [params.account!] }));
  }

  const props = { panel, filter, onFilter: setFilter };

  return (
    <Screen inTabs title={t('stats.title')} subtitle={t('stats.subtitle')}>
      <FilterBar filter={filter} panel={panel} onChange={setFilter} />
      <Chips options={SECTIONS.map((value) => ({ value, label: t(`stats.sections.${value}`) }))} value={section} onChange={setSection} />
      {section === 'overview' ? <OverviewSection {...props} /> : null}
      {section === 'dunya' ? <DunyaSection {...props} /> : null}
      {section === 'akhira' ? <AkhiraSection {...props} /> : null}
      {section === 'deeds' ? <DeedsSection {...props} /> : null}
      {section === 'entries' ? <EntriesSection {...props} /> : null}
    </Screen>
  );
}
