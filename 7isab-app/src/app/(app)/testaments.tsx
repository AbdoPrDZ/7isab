import { router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SearchBox } from '@/components/search/search-box';
import { TestamentCard } from '@/components/testaments/testament-card';
import { AppText } from '@/components/ui/app-text';
import { SettingsIcon } from '@/components/ui/icons';
import { Card, Chips, IconButton, Section, SectionAction, Screen } from '@/components/ui/layout';
import { useTheme } from '@/hooks/use-theme';
import type { TestamentCategory } from '@/lib/ledger/types';
import { foldQuery } from '@/lib/search/search';
import { foldText, matchesAll } from '@/lib/search/normalize';
import { TESTAMENT_CATEGORIES, useTestamentContent, useTestaments } from '@/lib/testaments/testaments';

type Filter = TestamentCategory | 'all';

/** Every Testament, by category. Opened from a notification, that Testament comes first. */
export default function TestamentsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const testaments = useTestaments();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const folded = foldQuery(useDeferredValue(query));
  const content = useTestamentContent();
  const opened = id ? testaments.find((testament) => testament.id === id) : undefined;
  const shown = testaments.filter((testament) => {
    if (filter !== 'all' && testament.category !== filter) return false;
    if (!folded) return true;
    const { text, source } = content(testament);
    return matchesAll(foldText(`${text} ${source ?? ''}`), folded);
  });
  const edit = (testamentId: string) => router.push({ pathname: '/testament/[id]', params: { id: testamentId } });

  return (
    <Screen
      back
      title={t('testaments.title')}
      subtitle={t('testaments.subtitle')}
      headerEnd={
        <IconButton label={t('testaments.settings')} tone="onHero" onPress={() => router.push('/testament-settings')}>
          <SettingsIcon size={22} color={theme.onHero} />
        </IconButton>
      }>
      {opened ? (
        <Section title={t('testaments.opened')}>
          <TestamentCard testament={opened} highlighted onPress={() => edit(opened.id)} />
        </Section>
      ) : null}

      <Section
        title={t('testaments.all')}
        action={<SectionAction label={t('testaments.add')} onPress={() => edit('new')} />}>
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('search.testamentsPlaceholder')} />
        <Chips
          options={[
            { value: 'all' as Filter, label: t('testaments.allCategories') },
            ...TESTAMENT_CATEGORIES.map((category) => ({ value: category as Filter, label: t(`testaments.categories.${category}`) })),
          ]}
          value={filter}
          onChange={setFilter}
        />
        {shown.length ? (
          shown.map((testament) => <TestamentCard key={testament.id} testament={testament} onPress={() => edit(testament.id)} />)
        ) : (
          <Card>
            <AppText variant="label" color="textSecondary" align="center">
              {folded ? t('search.noResults') : t('testaments.empty')}
            </AppText>
          </Card>
        )}
      </Section>
    </Screen>
  );
}
