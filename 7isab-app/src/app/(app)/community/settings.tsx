import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { backTo7isab } from '@/components/community/community-screen';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { leaveCommunity, updateCommunityProfile } from '@/lib/community/api';
import { useMemberProfile, useMembership } from '@/lib/community/membership';
import { useSession } from '@/lib/session/session-provider';

/** The member's public names, and leaving the community. Gender is changed only by an admin. */
export default function CommunitySettingsScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const { refresh } = useMembership();
  const profile = useMemberProfile();
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = firstName.trim() !== profile.first_name || lastName.trim() !== profile.last_name;

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('community.join.missing'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateCommunityProfile(token, { first_name: firstName.trim(), last_name: lastName.trim() });
      await refresh();
      router.back();
    } catch (caught) {
      setError(caught instanceof ApiError && caught.isNetworkError ? t('errors.network') : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    Alert.alert(t('community.settings.leaveTitle'), t('community.settings.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.settings.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveCommunity(token);
            backTo7isab();
          } catch {
            Alert.alert(t('errors.generic'));
          }
        },
      },
    ]);
  };

  return (
    <Screen back title={t('community.settings.title')}>
      {error ? (
        <Card tone="danger">
          <AppText color="danger">{error}</AppText>
        </Card>
      ) : null}

      <Section title={t('community.settings.names')}>
        <AppText color="textSecondary">{t('community.join.namesHint')}</AppText>
        <TextField label={t('community.firstName')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
        <TextField label={t('community.lastName')} value={lastName} onChangeText={setLastName} autoComplete="family-name" />
        <Button title={t('common.save')} loading={saving} disabled={!changed} onPress={save} />
      </Section>

      <Section title={t('community.gender')}>
        <AppText>{t(`community.genders.${profile.gender}`)}</AppText>
        <AppText variant="caption" color="textSecondary">
          {t('community.settings.genderHint')}
        </AppText>
      </Section>

      <Section title={t('community.settings.leaveTitle')}>
        <View style={styles.leave}>
          <AppText color="textSecondary">{t('community.settings.leaveHint')}</AppText>
          <Button title={t('community.settings.leave')} variant="secondary" onPress={leave} />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  leave: { gap: Spacing.three },
});
