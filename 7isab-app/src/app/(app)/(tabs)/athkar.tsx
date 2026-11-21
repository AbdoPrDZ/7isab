import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { SearchBox } from '@/components/search/search-box';
import { SearchGroups } from '@/components/search/search-results';
import { AppText } from '@/components/ui/app-text';
import { BeadsIcon, CheckIcon } from '@/components/ui/icons';
import { Card, Screen } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { isListComplete, useAthkarCounts, useAthkarList } from '@/lib/athkar/athkar';
import { ATHKAR_LIST_IDS, type AthkarListId } from '@/lib/athkar/data';
import { useFormat } from '@/lib/format';
import { foldQuery, useEverythingSearch } from '@/lib/search/search';

function ListCard({ listId }: { listId: AthkarListId }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const list = useAthkarList(listId);
  const counts = useAthkarCounts(listId);
  const done = list.filter((dhikr) => (counts[dhikr.id] ?? 0) >= dhikr.target).length;
  const complete = isListComplete(list, counts);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/athkar/[list]', params: { list: listId } })}>
      {({ pressed }) => (
        <Card tone={complete ? 'accent' : 'surface'} style={[styles.card, pressed && { opacity: 0.85 }]}>
          <View style={[styles.icon, { backgroundColor: complete ? theme.accent : theme.primarySoft }]}>
            {complete ? <CheckIcon size={24} color={theme.surface} /> : <BeadsIcon size={24} color={theme.primary} />}
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">{t(`athkar.lists.${listId}`)}</AppText>
            <AppText variant="caption" color="textSecondary">
              {list.length
                ? t('athkar.progress', { done: format.digits(done), total: format.digits(list.length) })
                : t('athkar.empty')}
            </AppText>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

export default function AthkarScreen() {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useEverythingSearch(deferred).filter((group) => group.id === 'athkar');
  const searching = !!foldQuery(deferred);

  return (
    <Screen inTabs title={t('athkar.title')} subtitle={t('athkar.subtitle')}>
      <SearchBox value={query} onChangeText={setQuery} placeholder={t('search.athkarPlaceholder')} />
      {searching ? (
        results.length ? (
          <SearchGroups groups={results} />
        ) : (
          <Card>
            <AppText variant="label" color="textSecondary" align="center">
              {t('search.noResults')}
            </AppText>
          </Card>
        )
      ) : (
        <View style={[styles.list, { direction }]}>
          {ATHKAR_LIST_IDS.map((listId) => (
            <ListCard key={listId} listId={listId} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: Spacing.three },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.four },
  icon: { width: 48, height: 48, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
});
