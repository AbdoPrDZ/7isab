import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { FullScreenWarning } from '@/components/alarms/full-screen-warning';
import { usePrayerFormat } from '@/components/prayer/prayer-format';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { Card, Chips, Divider, IconButton, Screen, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { nativeAlarm } from '@/lib/alarms/native-alarm';
import { hijriText } from '@/lib/calendar/hijri';
import { today } from '@/lib/dates';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import type { PrayerName } from '@/lib/ledger/types';
import { athanSounds, testAthan } from '@/lib/prayer/notifications';
import {
  METHODS,
  PRAYERS,
  prayerTimes,
  resolvedMadhab,
  resolvedMethod,
  updatePrayerSettings,
  usePrayerSettings,
  type PrayerSettings,
} from '@/lib/prayer/prayer';
import { applyPrayerSettings } from '@/lib/prayer/setup';

const REMINDERS = [0, 5, 10, 15, 20, 30];
/** Minutes after the athan before an unmarked prayer counts as missed; 0 = end of its time. */
const DEADLINES = [0, 30, 60, 120];
/** "Did you pray it?" minutes after the athan, and "it ends soon" minutes before its safe time ends (0 = off). */
const CHECK_INS = [0, 15, 30, 60];
const ENDING_SOON = [0, 10, 15, 30];

/** Calculation method, per-prayer athan and adjustment, sounds, reminder and the prayer tasks. */
export default function PrayerSettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const settings = usePrayerSettings();
  const { format } = useLedgerLabels();
  const { time: clock } = usePrayerFormat();
  const [testing, setTesting] = useState(false);
  const sounds = athanSounds();
  const times = prayerTimes(settings, today());

  const change = async (changes: Partial<Omit<PrayerSettings, 'id' | 'createdAt' | 'updatedAt'>>) => {
    await updatePrayerSettings(changes);
    await applyPrayerSettings();
  };

  const adjust = (prayer: PrayerName, delta: number) =>
    void change({
      adjust: { ...settings.adjust, [prayer]: Math.max(-60, Math.min(60, settings.adjust[prayer] + delta)) },
    });

  const soundOptions = [
    { value: 'default', label: t('prayer.sounds.default') },
    { value: 'silent', label: t('prayer.sounds.silent') },
    ...sounds.map((file) => ({ value: file, label: file.replace(/\.[a-z0-9]+$/, '').replace(/_/g, ' ') })),
  ];

  const test = async () => {
    setTesting(true);
    await testAthan().catch(() => undefined);
    setTimeout(() => setTesting(false), 5000);
  };

  return (
    <Screen back title={t('prayer.settings')}>
      <Section title={t('prayer.method')}>
        <Chips
          options={[
            { value: 'auto' as const, label: t('prayer.auto') },
            ...METHODS.map((value) => ({ value, label: t(`prayer.methods.${value}`) })),
          ]}
          value={settings.method}
          onChange={(method) => void change({ method })}
        />
        {settings.method === 'auto' ? (
          <AppText variant="caption" color="textSecondary">
            {t('prayer.autoUses', {
              method: t(`prayer.methods.${resolvedMethod(settings)}`),
              country: settings.location?.countryCode ?? '—',
            })}
          </AppText>
        ) : null}
      </Section>

      <Section title={t('prayer.asr')}>
        <Chips
          options={(['auto', 'shafi', 'hanafi'] as const).map((value) => ({
            value,
            label: value === 'auto' ? t('prayer.auto') : t(`prayer.madhabs.${value}`),
          }))}
          value={settings.madhab}
          onChange={(madhab) => void change({ madhab })}
        />
        {settings.madhab === 'auto' ? (
          <AppText variant="caption" color="textSecondary">
            {t(`prayer.madhabs.${resolvedMadhab(settings)}`)}
          </AppText>
        ) : null}
      </Section>

      <Section title={t('prayer.perPrayer')}>
        <AppText variant="caption" color="textSecondary">
          {t('prayer.adjustHint')}
        </AppText>
        <Card>
          {PRAYERS.map((prayer, index) => (
            <Fragment key={prayer}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.prayerRow}>
                <View style={styles.flex}>
                  <AppText variant="label" weight="semibold">
                    {t(`prayer.names.${prayer}`)}
                    {times ? ` · ${clock(times[prayer])}` : ''}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    {t('prayer.adjustValue', {
                      minutes: `${settings.adjust[prayer] > 0 ? '+' : ''}${format.number(settings.adjust[prayer])}`,
                    })}
                  </AppText>
                </View>
                <IconButton label="-1" size={32} onPress={() => adjust(prayer, -1)}>
                  <MinusIcon size={16} color={theme.primary} />
                </IconButton>
                <IconButton label="+1" size={32} onPress={() => adjust(prayer, 1)}>
                  <PlusIcon size={16} color={theme.primary} />
                </IconButton>
                <View style={styles.switchBox}>
                  <AppText variant="caption" color="textSecondary">
                    {t('prayer.athan')}
                  </AppText>
                  <Switch
                    value={settings.athan[prayer]}
                    onValueChange={(on) => void change({ athan: { ...settings.athan, [prayer]: on } })}
                    trackColor={{ true: theme.primary }}
                  />
                </View>
              </View>
            </Fragment>
          ))}
        </Card>
      </Section>

      {settings.tasks ? (
        <Section title={t('prayer.deadlineTitle')}>
          <AppText variant="caption" color="textSecondary">
            {t('prayer.deadlineHint')}
          </AppText>
          <Card>
            {PRAYERS.map((prayer, index) => (
              <Fragment key={prayer}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.deadlineRow}>
                  <AppText variant="label" weight="semibold">
                    {t(`prayer.names.${prayer}`)}
                  </AppText>
                  <Chips
                    options={DEADLINES.map((value) => ({
                      value,
                      label: value ? t('prayer.afterAthan', { minutes: format.number(value) }) : t('prayer.endOfTime'),
                    }))}
                    value={settings.deadline[prayer]}
                    onChange={(minutes) => void change({ deadline: { ...settings.deadline, [prayer]: minutes } })}
                  />
                </View>
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={t('prayer.sound')}>
        {nativeAlarm ? (
          <>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <AppText variant="label">{t('prayer.athanScreen')}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('prayer.athanScreenHint')}
                </AppText>
              </View>
              <Switch
                value={settings.athanScreen}
                onValueChange={(athanScreen) => void change({ athanScreen })}
                trackColor={{ true: theme.primary }}
              />
            </View>
            <FullScreenWarning />
          </>
        ) : null}
        <Chips options={soundOptions} value={settings.sound} onChange={(sound) => void change({ sound })} />
        {!sounds.length ? (
          <AppText variant="caption" color="textSecondary">
            {t('prayer.noAthanFiles')}
          </AppText>
        ) : null}
        <AppText variant="label" color="textSecondary">
          {t('prayer.fajrSound')}
        </AppText>
        <Chips
          options={[{ value: 'same', label: t('prayer.sameSound') }, ...soundOptions]}
          value={settings.fajrSound}
          onChange={(fajrSound) => void change({ fajrSound })}
        />
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText variant="label">{t('prayer.alarmStream')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('prayer.alarmStreamHint')}
            </AppText>
          </View>
          <Switch
            value={settings.alarmStream}
            onValueChange={(alarmStream) => void change({ alarmStream })}
            trackColor={{ true: theme.primary }}
          />
        </View>
        <Button
          title={testing ? t('prayer.testing') : t('prayer.test')}
          variant="secondary"
          onPress={() => void test()}
        />
      </Section>

      <Section title={t('prayer.reminder')}>
        <Chips
          options={REMINDERS.map((value) => ({
            value,
            label: value ? t('prayer.minutesBefore', { minutes: format.number(value) }) : t('prayer.off'),
          }))}
          value={settings.reminder}
          onChange={(reminder) => void change({ reminder })}
        />
      </Section>

      {settings.tasks ? (
        <Section title={t('prayer.nudges')}>
          <AppText variant="label" color="textSecondary">
            {t('prayer.checkInLabel')}
          </AppText>
          <Chips
            options={CHECK_INS.map((value) => ({
              value,
              label: value ? t('prayer.minutesAfter', { minutes: format.number(value) }) : t('prayer.off'),
            }))}
            value={settings.checkIn}
            onChange={(checkIn) => void change({ checkIn })}
          />
          <AppText variant="label" color="textSecondary">
            {t('prayer.endingLabel')}
          </AppText>
          <Chips
            options={ENDING_SOON.map((value) => ({
              value,
              label: value ? t('prayer.minutesBefore', { minutes: format.number(value) }) : t('prayer.off'),
            }))}
            value={settings.endingSoon}
            onChange={(endingSoon) => void change({ endingSoon })}
          />
          <AppText variant="caption" color="textSecondary">
            {t('prayer.nudgesHint')}
          </AppText>
        </Section>
      ) : null}

      <Section title={t('prayer.hijri')}>
        <Chips
          options={[-2, -1, 0, 1, 2].map((value) => ({
            value,
            label: value === 0 ? t('prayer.hijriNone') : `${value > 0 ? '+' : ''}${format.number(value)}`,
          }))}
          value={settings.hijriOffset}
          onChange={(hijriOffset) => void change({ hijriOffset })}
        />
        <AppText variant="caption" color="textSecondary">
          {t('prayer.hijriHint', { date: format.digits(hijriText(today(), i18n.language, 'long')) })}
        </AppText>
      </Section>

      <Section title={t('prayer.hisab')}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText variant="label">{t('prayer.tasks')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('prayer.tasksHint')}
            </AppText>
          </View>
          <Switch
            value={settings.tasks}
            onValueChange={(tasks) => void change({ tasks })}
            trackColor={{ true: theme.primary }}
          />
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  prayerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  switchBox: { alignItems: 'center' },
  deadlineRow: { gap: Spacing.one, paddingVertical: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
