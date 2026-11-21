import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { UpdateRow } from '@/components/update-row';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { LockIcon } from '@/components/ui/icons';
import { Card, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/lib/ledger/hooks';
import { updateSettings } from '@/lib/ledger/ledger';
import { useLockStore } from '@/lib/lock/app-lock';
import { setDigitPreference, useDigitPreference, type DigitPreference } from '@/lib/preferences/digits';
import { useSession } from '@/lib/session/session-provider';
import { syncNow, useSyncStore } from '@/lib/sync/sync-engine';
import { useFormat } from '@/lib/format';

function CurrencyField() {
  const { t } = useTranslation();
  const settings = useSettings();
  const [value, setValue] = useState(settings?.mainCurrency ?? '');

  return (
    <TextField
      label={t('settingsExtra.mainCurrency')}
      value={value}
      autoCapitalize="characters"
      maxLength={3}
      onChangeText={(text) => setValue(text.toUpperCase().replace(/[^A-Z]/g, ''))}
      onEndEditing={() => {
        if (value.length === 3 && value !== settings?.mainCurrency) void updateSettings({ mainCurrency: value });
        else setValue(settings?.mainCurrency ?? '');
      }}
    />
  );
}

/** Daily reminder of the tasks not done yet (off, or at a chosen time). */
function TaskReminderCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useSettings();
  const reminder = settings?.taskReminder ?? null;

  return (
    <Card style={styles.gap}>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <AppText variant="label">{t('notify.taskReminder')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('notify.taskReminderHint')}
          </AppText>
        </View>
        <Switch
          value={!!reminder}
          onValueChange={(on) => void updateSettings({ taskReminder: on ? { hour: 21, minute: 0 } : null })}
          trackColor={{ true: theme.primary }}
        />
      </View>
      {reminder ? (
        <TimeSpinner
          hour={reminder.hour}
          minute={reminder.minute}
          onChange={(hour, minute) => void updateSettings({ taskReminder: { hour, minute } })}
        />
      ) : null}
    </Card>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const { user, signOut } = useSession();
  const digits = useDigitPreference();
  const lockMode = useLockStore((state) => state.mode);
  const { syncing, lastSyncAt, error } = useSyncStore();

  const syncLabel = syncing
    ? t('settingsExtra.syncing')
    : error
      ? t('settingsExtra.syncError')
      : lastSyncAt
        ? t('settingsExtra.lastSync', {
            time: format.digits(new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
          })
        : t('settingsExtra.neverSynced');

  return (
    <Screen back title={t('settings.title')}>
      <Section title={t('settings.account')}>
        <Card>
          <View style={styles.accountRow}>
            <ProfileAvatar size={56} editable />
            <View style={styles.flex}>
              {user?.name ? <AppText variant="heading">{user.name}</AppText> : null}
              <AppText variant="label" color="textSecondary">
                {user?.email}
              </AppText>
            </View>
          </View>
          <Row title={t('account.title')} chevron onPress={() => router.push('/account')} />
          <View style={[styles.note, { backgroundColor: theme.primarySoft }]}>
            <LockIcon size={16} color={theme.primary} />
            <AppText variant="caption" color="primary" style={styles.flex}>
              {t('settings.encryptionNote')}
            </AppText>
          </View>
        </Card>
      </Section>

      <Section title={t('settings.appearance')}>
        <Card style={styles.gap}>
          <AppText variant="label">{t('settings.theme')}</AppText>
          <ThemeSwitcher />
          <Divider />
          <AppText variant="label">{t('settings.language')}</AppText>
          <LanguageSwitcher />
          <Divider />
          <AppText variant="label">{t('settingsExtra.digits')}</AppText>
          <SegmentedControl<DigitPreference>
            accessibilityLabel={t('settingsExtra.digits')}
            options={[
              { value: 'latn', label: t('settingsExtra.digitsLatn') },
              { value: 'arab', label: t('settingsExtra.digitsArab') },
            ]}
            value={digits}
            onChange={setDigitPreference}
          />
        </Card>
      </Section>

      <Section title={t('notify.title')}>
        <TaskReminderCard />
      </Section>

      <Section title={t('settingsExtra.days')}>
        <Card>
          <Row title={t('prayer.settings')} chevron onPress={() => router.push('/prayer-settings')} />
          <Divider />
          <Row title={t('bedtime.settings')} chevron onPress={() => router.push('/bedtime')} />
          <Divider />
          <Row title={t('report.settings')} chevron onPress={() => router.push('/report-settings')} />
          <Divider />
          <Row title={t('testaments.settings')} chevron onPress={() => router.push('/testament-settings')} />
        </Card>
      </Section>

      <Section title={t('settingsExtra.hisab')}>
        <Card>
          <CurrencyField />
          <AppText variant="caption" color="textSecondary">
            {t('settingsExtra.mainCurrencyHint')}
          </AppText>
          <Divider />
          <Row title={t('settingsExtra.rates')} chevron onPress={() => router.push('/rates')} />
          <Divider />
          <Row title={t('weekly.title')} subtitle={t('weekly.settingsHint')} chevron onPress={() => router.push('/akhira-weeks')} />
          <Divider />
          <Row title={t('settingsExtra.sinTypes')} chevron onPress={() => router.push({ pathname: '/sins', params: { mode: 'edit' } })} />
          <Divider />
          <Row title={t('wallet.categories')} chevron onPress={() => router.push('/wallet/categories')} />
        </Card>
      </Section>

      <Section title={t('settingsExtra.data')}>
        <Card>
          <Row
            title={t('settingsExtra.security')}
            value={t(`security.modes.${lockMode}`)}
            chevron
            onPress={() => router.push('/security')}
          />
          <Divider />
          <Row title={t('settingsExtra.sync')} subtitle={syncLabel} onPress={() => void syncNow()} />
        </Card>
      </Section>

      <Section title={t('settings.about')}>
        <Card>
          <AppText variant="label">{t('app.name')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
          </AppText>
          <Divider />
          <UpdateRow />
        </Card>
      </Section>

      <Button title={t('settings.signOut')} variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
});
