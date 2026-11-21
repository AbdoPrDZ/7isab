import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSpace, updateSpaceSettings } from '@/lib/community/api';
import { useMemberProfile } from '@/lib/community/membership';
import type { SpaceDetail } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

type PostingGender = SpaceDetail['posting_gender'];

/** The owner's settings: joining for a group; who posts and approval for a page. */
export default function SpaceSettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  // Only the owner opens this screen, so the owner's gender is the member's own.
  const { gender: ownerGender } = useMemberProfile();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [joinPolicy, setJoinPolicy] = useState<'open' | 'approval'>('open');
  const [postingPublic, setPostingPublic] = useState(true);
  const [postingGender, setPostingGender] = useState<PostingGender>('any');
  const [approval, setApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSpace(token, slug)
      .then(({ space: loaded }) => {
        if (cancelled) return;
        setSpace(loaded);
        setJoinPolicy(loaded.join_policy ?? 'open');
        setPostingPublic(loaded.posting_public);
        setPostingGender(loaded.posting_gender);
        setApproval(loaded.posting_requires_approval);
      })
      .catch(() => !cancelled && router.back());
    return () => {
      cancelled = true;
    };
  }, [token, slug]);

  const save = async () => {
    if (!space) return;
    setSaving(true);
    try {
      await updateSpaceSettings(
        token,
        space.id,
        space.type === 'group'
          ? { join_policy: joinPolicy }
          : { posting_public: postingPublic, posting_gender: postingGender, posting_requires_approval: approval },
      );
      router.back();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  if (!space) {
    return (
      <Screen back title={t('community.spaces.settings')}>
        <ActivityIndicator size="large" color={theme.primary} style={styles.center} />
      </Screen>
    );
  }

  // A page for one gender can only be limited to that gender.
  const genderOptions: { value: PostingGender; label: string }[] = [
    { value: 'any', label: t('community.spaces.anyGender') },
    ...(['male', 'female'] as const)
      .filter((gender) => space.audience === 'everyone' || gender === ownerGender)
      .map((gender) => ({ value: gender as PostingGender, label: t(`community.genders.${gender}`) })),
  ];

  return (
    <Screen back title={t('community.spaces.settings')} subtitle={space.name} footer={<Button title={t('common.save')} loading={saving} onPress={save} />}>
      {space.type === 'group' ? (
        <Section title={t('community.spaces.joining')}>
          <Chips
            options={[
              { value: 'open' as const, label: t('community.spaces.joinPolicies.open') },
              { value: 'approval' as const, label: t('community.spaces.joinPolicies.approval') },
            ]}
            value={joinPolicy}
            onChange={setJoinPolicy}
          />
        </Section>
      ) : (
        <>
          <Section title={t('community.spaces.posting')}>
            <SwitchRow
              label={t('community.spaces.postingPublic')}
              hint={t('community.spaces.postingPublicHint')}
              value={postingPublic}
              onChange={setPostingPublic}
            />
            <SwitchRow
              label={t('community.spaces.postingApproval')}
              hint={t('community.spaces.postingApprovalHint')}
              value={approval}
              onChange={setApproval}
            />
          </Section>
          {postingPublic ? (
            <Section title={t('community.spaces.postingGender')}>
              <Chips options={genderOptions} value={postingGender} onChange={setPostingGender} />
            </Section>
          ) : null}
        </>
      )}
      <AppText variant="caption" color="textSecondary">
        {t('community.spaces.settingsHint')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
});
