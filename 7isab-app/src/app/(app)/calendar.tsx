import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { DayView, MonthView, WeekView, YearView } from '@/components/calendar/views';
import { AppText } from '@/components/ui/app-text';
import { BackIcon } from '@/components/ui/icons';
import { Chips, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { weekDays } from '@/lib/calendar/calendar';
import { addDays, addMonths, monthOf, today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels, useTasks } from '@/lib/ledger/hooks';
import { RecordTypes, type TaskProgress } from '@/lib/ledger/types';
import { usePrayerSettings } from '@/lib/prayer/prayer';

type View_ = 'day' | 'week' | 'month' | 'year';

function shift(day: string, view: View_, amount: number): string {
  if (view === 'day') return addDays(day, amount);
  if (view === 'week') return addDays(day, amount * 7);
  if (view === 'month') return `${addMonths(monthOf(day), amount)}-01`;
  return `${Number(day.slice(0, 4)) + amount}-01-01`;
}

/** Tasks and prayer times by day, week, month or year. */
export default function CalendarScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const { format } = useLedgerLabels();
  const tasks = useTasks();
  const prayer = usePrayerSettings();
  // Re-render when progress changes (a prayer or task ticked).
  useDocs<TaskProgress>(RecordTypes.progress);
  const [view, setView] = useState<View_>('month');
  const [day, setDay] = useState(today());

  const week = weekDays(day);
  const label =
    view === 'day'
      ? format.day(day, 'long')
      : view === 'week'
        ? `${format.day(week[0])} – ${format.day(week[6])}`
        : view === 'month'
          ? format.month(monthOf(day))
          : format.digits(day.slice(0, 4));

  const openDay = (date: string) => {
    setDay(date);
    setView('day');
  };

  return (
    <Screen back title={t('calendar.title')}>
      <Chips
        options={(['day', 'week', 'month', 'year'] as View_[]).map((value) => ({ value, label: t(`calendar.views.${value}`) }))}
        value={view}
        onChange={setView}
      />

      <View style={styles.nav}>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(shift(day, view, -1))}>
          <BackIcon size={22} color={theme.primary} flip={isRtl} />
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setDay(today())}>
          <AppText variant="heading" align="center">
            {label}
          </AppText>
          <AppText variant="caption" color="primary" align="center">
            {t('calendar.today')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(shift(day, view, 1))}>
          <BackIcon size={22} color={theme.primary} flip={!isRtl} />
        </Pressable>
      </View>

      {view === 'day' ? <DayView day={day} tasks={tasks} prayer={prayer} /> : null}
      {view === 'week' ? <WeekView day={day} tasks={tasks} prayer={prayer} onOpenDay={openDay} /> : null}
      {view === 'month' ? (
        <>
          <MonthView month={monthOf(day)} selected={day} tasks={tasks} onSelect={setDay} />
          <DayView day={day} tasks={tasks} prayer={prayer} />
        </>
      ) : null}
      {view === 'year' ? (
        <YearView
          year={day.slice(0, 4)}
          tasks={tasks}
          onOpenMonth={(month) => {
            setDay(`${month}-01`);
            setView('month');
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.two },
});
