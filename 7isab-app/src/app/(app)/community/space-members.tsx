import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSpaceMembers, moderateMember, setMemberRole } from '@/lib/community/api';
import { useMemberProfile } from '@/lib/community/membership';
import type { SpaceMemberItem, SpaceMemberStatus } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** Owner and moderators: join requests, members, removed people; the owner also appoints moderators. */
export default function SpaceMembersScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const me = useMemberProfile();
  const params = useLocalSearchParams<{ id: string; owner: string }>();
  const spaceId = Number(params.id);
  const isOwner = params.owner === '1';
  const [status, setStatus] = useState<SpaceMemberStatus>('active');
  const [members, setMembers] = useState<SpaceMemberItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getSpaceMembers(token, spaceId, status)
      .then((result) => !cancelled && setMembers(result.members))
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [token, spaceId, status]);

  useFocusEffect(load);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
      load();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = (member: SpaceMemberItem) =>
    Alert.alert(t('community.spaces.removeTitle'), t('community.spaces.removeHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.spaces.remove'),
        style: 'destructive',
        onPress: () => run(`${member.id}:ban`, () => moderateMember(token, spaceId, member.id, 'ban')),
      },
    ]);

  return (
    <Screen back title={t('community.spaces.members')}>
      <Chips
        options={[
          { value: 'active' as SpaceMemberStatus, label: t('community.spaces.memberStatuses.active') },
          { value: 'pending' as SpaceMemberStatus, label: t('community.spaces.memberStatuses.pending') },
          { value: 'banned' as SpaceMemberStatus, label: t('community.spaces.memberStatuses.banned') },
        ]}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setMembers(null);
        }}
      />

      {!members ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {members && members.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.spaces.noMembers')}
        </AppText>
      ) : null}

      {members?.map((member) => {
        const name = member.profile ? `${member.profile.first_name} ${member.profile.last_name}` : '';
        const canModerate = member.role !== 'owner' && member.profile?.id !== me.id && (isOwner || member.role !== 'moderator');
        const canPromote = isOwner && member.profile?.gender === me.gender && member.role !== 'owner';

        return (
          <Card key={member.id} style={styles.member}>
            <AppText weight="semibold">{name}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t(`community.spaces.roles.${member.role}`)}
            </AppText>
            <View style={styles.actions}>
              {member.status === 'pending' ? (
                <>
                  <Button
                    title={t('community.spaces.accept')}
                    loading={busy === `${member.id}:approve`}
                    onPress={() => run(`${member.id}:approve`, () => moderateMember(token, spaceId, member.id, 'approve'))}
                  />
                  <Button
                    title={t('community.spaces.decline')}
                    variant="ghost"
                    loading={busy === `${member.id}:reject`}
                    onPress={() => run(`${member.id}:reject`, () => moderateMember(token, spaceId, member.id, 'reject'))}
                  />
                </>
              ) : null}
              {member.status === 'active' && canPromote ? (
                <Button
                  title={member.role === 'moderator' ? t('community.spaces.unmakeModerator') : t('community.spaces.makeModerator')}
                  variant="secondary"
                  loading={busy === `${member.id}:role`}
                  onPress={() =>
                    run(`${member.id}:role`, () =>
                      setMemberRole(token, spaceId, member.id, member.role === 'moderator' ? 'member' : 'moderator'),
                    )
                  }
                />
              ) : null}
              {member.status === 'active' && canModerate ? (
                <Button title={t('community.spaces.remove')} variant="ghost" onPress={() => confirmRemove(member)} />
              ) : null}
              {member.status === 'banned' ? (
                <Button
                  title={t('community.spaces.allowBack')}
                  variant="secondary"
                  loading={busy === `${member.id}:unban`}
                  onPress={() => run(`${member.id}:unban`, () => moderateMember(token, spaceId, member.id, 'unban'))}
                />
              ) : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.five },
  member: { gap: Spacing.one },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
