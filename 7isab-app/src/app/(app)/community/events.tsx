import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { PostCard } from '@/components/community/post-card';
import { AppText } from '@/components/ui/app-text';
import { Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getUpcomingEvents } from '@/lib/community/api';
import type { CommunityPost } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** Upcoming events and lessons from the member's groups and pages, soonest first. */
export default function EventsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getUpcomingEvents(token)
      .then((page) => !cancelled && setPosts(page.posts))
      .catch(() => !cancelled && setPosts([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useFocusEffect(load);

  return (
    <Screen back title={t('community.menu.events')} subtitle={t('community.events.subtitle')}>
      {!posts ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {posts && posts.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.events.none')}
        </AppText>
      ) : null}
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} showSpace />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
});
