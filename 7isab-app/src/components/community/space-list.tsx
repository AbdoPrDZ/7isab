import { router, useFocusEffect } from 'expo-router';
import { useCallback, useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CommunityScreen } from '@/components/community/community-screen';
import { SearchBox } from '@/components/search/search-box';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips, Row, Section, SectionAction } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listSpaces } from '@/lib/community/api';
import type { SpaceSummary, SpaceType } from '@/lib/community/types';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { useSession } from '@/lib/session/session-provider';

type Scope = 'mine' | 'discover';

/** The Groups and Pages tabs: the user's own, and discovery (only what their gender may see). */
export function SpaceList({ type }: { type: SpaceType }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { format } = useLedgerLabels();
  const [scope, setScope] = useState<Scope>('mine');
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim());
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    listSpaces(token, { type, scope, search: scope === 'discover' ? search : undefined })
      .then((result) => {
        if (cancelled) return;
        setSpaces(result.spaces);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, type, scope, search]);

  useFocusEffect(load);

  const status = (space: SpaceSummary) => {
    if (space.my_role === 'owner') return t('community.spaces.roles.owner');
    if (space.my_role === 'moderator') return t('community.spaces.roles.moderator');
    if (space.my_status === 'pending') return t('community.spaces.pending');
    if (space.members_count !== null) return t('community.spaces.membersCount', { count: format.number(space.members_count) });
    return undefined;
  };

  return (
    <CommunityScreen title={t(`community.tabs.${type}s`)}>
      <Chips
        options={[
          { value: 'mine' as Scope, label: t(`community.spaces.mine.${type}`) },
          { value: 'discover' as Scope, label: t('community.spaces.discover') },
        ]}
        value={scope}
        onChange={(value) => {
          setScope(value);
          setSpaces(null);
        }}
      />
      {scope === 'discover' ? (
        <SearchBox value={query} onChangeText={setQuery} placeholder={t('community.spaces.searchPlaceholder')} />
      ) : null}

      <Section
        action={
          <SectionAction
            label={t(`community.spaces.request.${type}`)}
            onPress={() => router.push({ pathname: '/community/request', params: { type } })}
          />
        }>
        {failed ? (
          <View style={styles.center}>
            <AppText color="textSecondary" align="center">
              {t('community.loadFailed')}
            </AppText>
            <Button title={t('community.retry')} variant="secondary" onPress={() => load()} />
          </View>
        ) : null}
        {!spaces && !failed ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
        {spaces && spaces.length === 0 ? (
          <AppText color="textSecondary" align="center" style={styles.center}>
            {scope === 'mine' ? t(`community.spaces.emptyMine.${type}`) : t('community.spaces.emptyDiscover')}
          </AppText>
        ) : null}
        {spaces?.map((space) => (
          <Row
            key={space.id}
            title={space.name}
            subtitle={space.purpose}
            value={status(space)}
            chevron
            onPress={() => router.push({ pathname: '/community/space/[slug]', params: { slug: space.slug } })}
          />
        ))}
      </Section>
    </CommunityScreen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.five, gap: Spacing.three, alignItems: 'center' },
});
