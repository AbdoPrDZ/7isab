import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BedtimeCard } from '@/components/bedtime/bedtime-card';
import { HisabQuickActions, NegativeWarnings } from '@/components/hisab/quick-actions';
import { PrayerCard } from '@/components/prayer/prayer-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AlarmIcon, BookIcon, CalendarIcon, CheckIcon, MinusIcon, PlusIcon, SettingsIcon } from '@/components/ui/icons';
import { Card, Divider, IconButton, Row, Screen, Section, SectionAction } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePrayerFormat } from '@/components/prayer/prayer-format';
import { hijriText } from '@/lib/calendar/hijri';
import { today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { useAccounts, useBalances, useLedgerLabels, useTasks } from '@/lib/ledger/hooks';
import { nafilahWindow } from '@/lib/ledger/presets';
import {
  addProgress,
  daysLeft,
  getProgressValue,
  isDue,
  isPeriodTask,
  progressRatio,
  setProgress,
  taskPeriod,
} from '@/lib/ledger/tasks';
import { prayerTimes, usePrayerSettings } from '@/lib/prayer/prayer';
import { RecordTypes, type Task, type TaskProgress } from '@/lib/ledger/types';
import { useReadingState } from '@/lib/quran/reading';
import { useSession } from '@/lib/session/session-provider';

function greetingKey(): 'home.greetingMorning' | 'home.greetingEvening' {
  const hour = new Date().getHours();
  return hour < 15 ? 'home.greetingMorning' : 'home.greetingEvening';
}

function TaskCard({ task, day }: { task: Task; day: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  // Re-render when this task's progress changes.
  useDocs<TaskProgress>(RecordTypes.progress);
  const value = getProgressValue(task, day);
  const ratio = progressRatio(task, value);
  const period = taskPeriod(task);
  const periodLabel = isPeriodTask(task) ? t(period ? `task.this.${period}` : 'task.this.hijriMonth') : null;
  const done = ratio >= 1;
  const step = task.target.unit === 'pages' ? 1 : task.target.unit === 'words' ? 50 : 1;
  const prayer = usePrayerSettings();
  const { time: clock } = usePrayerFormat();

  // Nafilah: when it can be prayed. Fasting: suhoor ends at Fajr, iftar at Maghrib.
  let timing: string | null = null;
  if (task.kind === 'nafilah' && task.nafilah) {
    const window = nafilahWindow(task.nafilah, prayer, day);
    if (window) timing = t('task.window', { from: clock(window.from), to: clock(window.to) });
  } else if (task.kind === 'fasting') {
    const times = prayerTimes(prayer, day);
    if (times) timing = t('task.fastTimes', { suhoor: clock(times.fajr), iftar: clock(times.maghrib) });
  }

  return (
    <Card style={done ? { borderColor: theme.accent } : undefined}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        style={styles.taskHeader}>
        <View style={styles.flex}>
          <AppText variant="heading">{task.title}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t(`task.kinds.${task.kind}`)}
            {periodLabel
              ? ` · ${periodLabel} · ${t('task.daysLeft', { count: format.number(daysLeft(task, day)) })}`
              : ''}
            {task.target.unit !== 'check'
              ? ` · ${t('today.progress', { value: format.number(value), target: format.number(task.target.amount) })} ${t(`task.units.${task.target.unit}`)}`
              : ''}
          </AppText>
          {timing ? (
            <AppText variant="caption" color="primary">
              {timing}
            </AppText>
          ) : null}
        </View>
        {task.target.unit === 'check' ? (
          <IconButton
            label={t('common.done')}
            tone={done ? 'solid' : 'soft'}
            onPress={() => void setProgress(task, day, done ? 0 : 1)}>
            <CheckIcon size={22} color={done ? theme.textOnPrimary : theme.primary} />
          </IconButton>
        ) : (
          <View style={styles.stepper}>
            <IconButton label="-" onPress={() => void addProgress(task, day, -step)} size={34}>
              <MinusIcon size={18} color={theme.primary} />
            </IconButton>
            <IconButton label="+" tone="solid" onPress={() => void addProgress(task, day, step)} size={34}>
              <PlusIcon size={18} color={theme.textOnPrimary} />
            </IconButton>
          </View>
        )}
      </Pressable>
      {task.target.unit !== 'check' ? (
        <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(ratio * 100)}%`, backgroundColor: done ? theme.accent : theme.primary },
            ]}
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { user } = useSession();
  const tasks = useTasks();
  const accounts = useAccounts();
  const balances = useBalances();
  const { accountName, amount, format } = useLedgerLabels();
  const reading = useReadingState();
  const day = today();
  // Prayer tasks are checked on the prayer card.
  const dueTasks = tasks.filter((task) => isDue(task, day) && task.kind !== 'prayer' && task.kind !== 'bedtime');
  const fixed = accounts.filter((account) => account.fixed);

  const greeting = t(greetingKey());
  const title = user?.name ? t('home.greetingName', { greeting, name: user.name.split(' ')[0] }) : greeting;
  const hijri = hijriText(today(), i18n.language, 'long') || null;

  return (
    <Screen
      inTabs
      title={title}
      subtitle={[format.day(day, 'long'), hijri ? format.digits(hijri) : null].filter(Boolean).join(' · ')}
      headerEnd={
        <View style={styles.headerButtons}>
          <IconButton label={t('alarm.listTitle')} tone="onHero" onPress={() => router.push('/alarms')}>
            <AlarmIcon size={22} color={theme.onHero} />
          </IconButton>
          <IconButton label={t('calendar.title')} tone="onHero" onPress={() => router.push('/calendar')}>
            <CalendarIcon size={22} color={theme.onHero} />
          </IconButton>
          <IconButton label={t('settings.open')} tone="onHero" onPress={() => router.push('/settings')}>
            <SettingsIcon size={22} color={theme.onHero} />
          </IconButton>
        </View>
      }>
      <PrayerCard />
      <BedtimeCard />
      <Card>
        <Row title={t('report.todayReport')} subtitle={t('report.todayReportHint')} chevron onPress={() => router.push('/report')} />
        <Divider />
        <Row title={t('programs.title')} subtitle={t('programs.todayHint')} chevron onPress={() => router.push('/programs')} />
      </Card>

      <NegativeWarnings />
      <Section title={t('today.balances')}>
        <View style={styles.balances}>
          {fixed.map((account) => {
            const value = balances.get(account.id) ?? 0;
            const negative = value < 0 && account.fixed !== 'akhira';
            return (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/stats', params: { section: 'akhira' } })}
                style={[
                  styles.balance,
                  {
                    backgroundColor: negative ? theme.dangerSoft : theme.surface,
                    borderColor: negative ? theme.danger : account.fixed === 'akhira' ? theme.accent : theme.border,
                  },
                ]}>
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {accountName(account)}
                </AppText>
                <AppText variant="label" weight="bold" color={negative ? 'danger' : 'text'} numberOfLines={1}>
                  {amount(account, value)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <HisabQuickActions />

      {reading ? (
        <Card tone="accent">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/quran/[page]', params: { page: String(reading.page) } })}
            style={styles.readingRow}>
            <BookIcon size={26} color={theme.primary} />
            <View style={styles.flex}>
              <AppText variant="label" weight="semibold">
                {t('today.continueReading')}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('reading.resume', { page: format.digits(reading.page) })} ·{' '}
                {t('today.readingToday', { words: format.number(reading.wordsToday) })}
              </AppText>
            </View>
          </Pressable>
        </Card>
      ) : null}

      <Section
        title={t('today.tasks')}
        action={<SectionAction label={t('today.manageTasks')} plus={false} onPress={() => router.push('/tasks')} />}>
        {dueTasks.length ? (
          dueTasks.map((task) => <TaskCard key={task.id} task={task} day={day} />)
        ) : (
          <Card>
            <AppText variant="label" color="textSecondary" align="center">
              {t('today.noTasks')}
            </AppText>
          </Card>
        )}
        <Button
          title={t('today.addTask')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })}
        />
      </Section>

      <View style={styles.quick}>
        <Button
          title={t('today.logSin')}
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push('/sins')}
        />
        <Button
          title={t('today.giveSadaqa')}
          style={styles.flex}
          onPress={() => router.push({ pathname: '/hisab/action', params: { kind: 'sadaqa' } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: Spacing.two },
  balances: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  balance: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: 2,
  },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepper: { flexDirection: 'row', gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  quick: { flexDirection: 'row', gap: Spacing.two },
});
