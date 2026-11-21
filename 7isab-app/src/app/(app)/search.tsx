import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { QuranResults } from '@/components/search/quran-results';
import { SearchBox } from '@/components/search/search-box';
import { SearchGroups } from '@/components/search/search-results';
import { AppText } from '@/components/ui/app-text';
import { Card, Screen } from '@/components/ui/layout';
import { foldQuery, useEverythingSearch } from '@/lib/search/search';

/** Searches everything: the Quran (offline), athkar, Testaments, wallet activity, tasks, notes, accounts, alarms. */
export default function SearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const groups = useEverythingSearch(deferred);
  const searching = !!foldQuery(deferred);

  return (
    <Screen back title={t('search.title')} subtitle={t('search.subtitle')}>
      <SearchBox value={query} onChangeText={setQuery} autoFocus />
      {searching ? (
        <>
          <SearchGroups groups={groups} />
          <QuranResults query={deferred} compact={groups.length > 0} />
        </>
      ) : (
        <Card>
          <AppText variant="label" color="textSecondary" align="center">
            {t('search.hint')}
          </AppText>
        </Card>
      )}
    </Screen>
  );
}
