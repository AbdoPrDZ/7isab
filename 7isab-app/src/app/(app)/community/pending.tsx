import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/community/post-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPendingPosts, reviewPost } from '@/lib/community/api';
import type { CommunityPost } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** Posts waiting for the owner or a moderator, oldest first. */
export default function PendingPostsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getPendingPosts(token, Number(id))
      .then((page) => !cancelled && setPosts(page.posts))
      .catch(() => !cancelled && setPosts([]));
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  useFocusEffect(load);

  const review = async (post: CommunityPost, decision: 'approve' | 'reject') => {
    setBusy(`${post.id}:${decision}`);
    try {
      await reviewPost(token, post.id, decision);
      load();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen back title={t('community.posts.queue')}>
      {!posts ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {posts && posts.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.posts.queueEmpty')}
        </AppText>
      ) : null}
      {posts?.map((post) => (
        <View key={post.id} style={styles.item}>
          <PostCard post={post} openable={false} />
          <View style={styles.row}>
            <Button
              title={t('community.posts.approve')}
              style={styles.flex}
              loading={busy === `${post.id}:approve`}
              onPress={() => review(post, 'approve')}
            />
            <Button
              title={t('community.posts.reject')}
              variant="ghost"
              style={styles.flex}
              loading={busy === `${post.id}:reject`}
              onPress={() => review(post, 'reject')}
            />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  item: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
