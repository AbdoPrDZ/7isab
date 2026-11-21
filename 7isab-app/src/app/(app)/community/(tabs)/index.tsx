import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CommunityScreen } from '@/components/community/community-screen';
import { ImportSheet } from '@/components/community/import-sheet';
import { PostCard } from '@/components/community/post-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { getCommunityFeed } from '@/lib/community/api';
import type { CommunityPost } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

type FeedState =
  | { status: 'loading' }
  | { status: 'ready'; posts: CommunityPost[] }
  | { status: 'error'; message: string; canRetry: boolean };

/** Posts from the groups the user joined and the pages they follow. */
export default function CommunityFeedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [feed, setFeed] = useState<FeedState>({ status: 'loading' });
  const [importing, setImporting] = useState<CommunityPost | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await getCommunityFeed(token);
      setFeed({ status: 'ready', posts: page.posts });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setFeed({ status: 'error', message: t('community.notMember'), canRetry: false });
      } else if (error instanceof ApiError && error.isNetworkError) {
        setFeed({ status: 'error', message: t('errors.network'), canRetry: true });
      } else {
        setFeed({ status: 'error', message: t('community.loadFailed'), canRetry: true });
      }
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const retry = () => {
    setFeed({ status: 'loading' });
    load();
  };

  // Refresh after an import so the count is current.
  const closeImport = () => {
    setImporting(null);
    load();
  };

  return (
    <CommunityScreen title={t('community.title')} subtitle={t('community.subtitle')}>
      {feed.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {feed.status === 'error' ? (
        <View style={styles.center}>
          <AppText color="textSecondary" align="center">
            {feed.message}
          </AppText>
          {feed.canRetry ? <Button title={t('community.retry')} variant="secondary" onPress={retry} /> : null}
        </View>
      ) : null}

      {feed.status === 'ready' && feed.posts.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.empty')}
        </AppText>
      ) : null}

      {feed.status === 'ready'
        ? feed.posts.map((post) => <PostCard key={post.id} post={post} onImport={setImporting} />)
        : null}

      <ImportSheet post={importing} onClose={closeImport} />
    </CommunityScreen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six, gap: Spacing.three, alignItems: 'center' },
});
