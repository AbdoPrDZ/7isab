import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ImportSheet } from '@/components/community/import-sheet';
import { PostCard } from '@/components/community/post-card';
import { AppText } from '@/components/ui/app-text';
import { Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSavedPosts } from '@/lib/community/api';
import type { CommunityPost } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** Posts the member saved (only ones they can still see). */
export default function SavedPostsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [importing, setImporting] = useState<CommunityPost | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getSavedPosts(token)
      .then((page) => !cancelled && setPosts(page.posts))
      .catch(() => !cancelled && setPosts([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useFocusEffect(load);

  return (
    <Screen back title={t('community.menu.saved')}>
      {!posts ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {posts && posts.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.posts.savedEmpty')}
        </AppText>
      ) : null}
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} showSpace onImport={setImporting} />
      ))}
      <ImportSheet
        post={importing}
        onClose={() => {
          setImporting(null);
          load();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
});
