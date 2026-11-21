import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ImportSheet } from '@/components/community/import-sheet';
import { PostCard } from '@/components/community/post-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Row, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { getSpace, getSpacePosts, spaceAction } from '@/lib/community/api';
import type { CommunityPost, SpaceDetail } from '@/lib/community/types';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { useSession } from '@/lib/session/session-provider';

/** A group or page: what it's for, joining or following, management, and its posts. */
export default function SpaceScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { format } = useLedgerLabels();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<CommunityPost | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getSpace(token, slug)
      .then(async ({ space: loaded }) => {
        // Only people in the space read its posts; others see its description.
        const page = loaded.my_status === 'active' ? await getSpacePosts(token, loaded.id) : { posts: [] };
        if (cancelled) return;
        setSpace(loaded);
        setPosts(page.posts);
        setFailed(false);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setMissing(true);
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, slug]);

  useFocusEffect(load);

  const reload = () => {
    load();
  };

  const act = async (action: 'join' | 'leave' | 'follow' | 'unfollow') => {
    if (!space) return;
    setBusy(true);
    try {
      await spaceAction(token, space.id, action);
      reload();
    } catch (error) {
      const reason = error instanceof ApiError && error.status === 403 ? 'community.spaces.removed' : 'errors.generic';
      Alert.alert(t(reason));
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () =>
    Alert.alert(t('community.spaces.leaveTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('community.spaces.leave'), style: 'destructive', onPress: () => act('leave') },
    ]);

  if (!space) {
    return (
      <Screen back title={t('community.title')}>
        <View style={styles.center}>
          {missing ? <AppText color="textSecondary">{t('community.spaces.missing')}</AppText> : null}
          {failed ? (
            <>
              <AppText color="textSecondary">{t('community.loadFailed')}</AppText>
              <Button title={t('community.retry')} variant="secondary" onPress={reload} />
            </>
          ) : null}
          {!missing && !failed ? <ActivityIndicator size="large" color={theme.primary} /> : null}
        </View>
      </Screen>
    );
  }

  const isGroup = space.type === 'group';
  const mode = isGroup ? t(`community.spaces.joinPolicies.${space.join_policy ?? 'open'}`) : t(`community.spaces.audiences.${space.audience}`);

  return (
    <Screen back title={space.name} subtitle={`${t(`community.spaces.types.${space.type}`)} · ${mode}`}>
      <Card style={styles.info}>
        <Field label={t('community.spaces.fields.purpose')} value={space.purpose} />
        <Field label={t('community.spaces.fields.goals')} value={space.goals} />
        <Field label={t('community.spaces.fields.content_plan')} value={space.content_plan} />
        <AppText variant="caption" color="textSecondary">
          {t('community.spaces.ownerLine', {
            owner: `${space.owner.first_name} ${space.owner.last_name}`,
            count: format.number(space.members_count),
          })}
        </AppText>
      </Card>

      <MembershipAction space={space} busy={busy} onAct={act} onLeave={confirmLeave} />

      {space.can_post ? (
        <Button
          title={t('community.compose.title')}
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/community/compose',
              params: { spaceId: String(space.id), name: space.name, openPage: space.type === 'page' && space.audience === 'everyone' ? '1' : '0' },
            })
          }
        />
      ) : null}

      {space.can_manage ? (
        <Section title={t('community.spaces.manage')}>
          <Row
            title={t('community.spaces.members')}
            chevron
            onPress={() =>
              router.push({
                pathname: '/community/space-members',
                params: { id: String(space.id), owner: space.my_role === 'owner' ? '1' : '0' },
              })
            }
          />
          <Row
            title={t('community.posts.queue')}
            chevron
            onPress={() => router.push({ pathname: '/community/pending', params: { id: String(space.id) } })}
          />
          {space.my_role === 'owner' ? (
            <Row
              title={t('community.spaces.settings')}
              chevron
              onPress={() => router.push({ pathname: '/community/space-settings', params: { slug: space.slug } })}
            />
          ) : null}
        </Section>
      ) : null}

      <Section title={t('community.spaces.posts')}>
        {space.my_status !== 'active' ? (
          <AppText color="textSecondary">{t(`community.spaces.postsLocked.${space.type}`)}</AppText>
        ) : posts.length === 0 ? (
          <AppText color="textSecondary">{t('community.spaces.noPosts')}</AppText>
        ) : null}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onImport={setImporting} />
        ))}
      </Section>

      <ImportSheet
        post={importing}
        onClose={() => {
          setImporting(null);
          reload();
        }}
      />
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

function MembershipAction({
  space,
  busy,
  onAct,
  onLeave,
}: {
  space: SpaceDetail;
  busy: boolean;
  onAct: (action: 'join' | 'leave' | 'follow' | 'unfollow') => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();

  if (space.my_status === 'banned') {
    return <AppText color="textSecondary">{t('community.spaces.removed')}</AppText>;
  }
  if (space.my_role === 'owner') return null;

  if (space.type === 'page') {
    if (space.my_role === 'moderator') return null;
    return space.my_role === 'follower' ? (
      <Button title={t('community.spaces.unfollow')} variant="secondary" loading={busy} onPress={() => onAct('unfollow')} />
    ) : (
      <Button title={t('community.spaces.follow')} loading={busy} onPress={() => onAct('follow')} />
    );
  }

  if (space.my_status === 'pending') {
    return (
      <View style={styles.pending}>
        <AppText color="textSecondary">{t('community.spaces.pendingHint')}</AppText>
        <Button title={t('community.spaces.withdraw')} variant="ghost" loading={busy} onPress={() => onAct('leave')} />
      </View>
    );
  }
  if (space.my_status === 'active') {
    return <Button title={t('community.spaces.leave')} variant="ghost" loading={busy} onPress={onLeave} />;
  }

  return (
    <Button
      title={space.join_policy === 'approval' ? t('community.spaces.askToJoin') : t('community.spaces.join')}
      loading={busy}
      onPress={() => onAct('join')}
    />
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six, gap: Spacing.three, alignItems: 'center' },
  info: { gap: Spacing.three },
  field: { gap: Spacing.half },
  pending: { gap: Spacing.two },
});
