/**
 * Calendar views: day (prayer times and tasks), week (7 rows), month (grid
 * with a detail panel) and year (12 small months as a heat map). Colour shows
 * how much of the day's tasks were done (one hue, light → dark); the text and
 * the legend say the same, so nothing is read from colour alone.
 */
import { router } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePrayerFormat } from '@/components/prayer/prayer-format';
import { openPrayerSheet } from '@/components/prayer/prayer-sheet';
import { AppText } from '@/components/ui/app-text';
import { CheckIcon } from '@/components/ui/icons';
import { Card, Divider, Row, Section } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  dayTasks,
  monthGrid,
  periodTasks,
  summarize,
  weekDays,
  weekOrder,
  type DaySummary,
  type DayTask,
  type TaskState,
} from '@/lib/calendar/calendar';
import { hijriText as hijri, specialDays, type SpecialDay } from '@/lib/calendar/hijri';
import { today } from '@/lib/dates';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import type { Task } from '@/lib/ledger/types';
import { PRAYERS, prayerTimes, type PrayerSettings } from '@/lib/prayer/prayer';
import { canMarkPrayer, prayerState } from '@/lib/prayer/tasks';

/** Background for a day by how much was done (sequential, one hue). */
function useHeat() {
  const theme = useTheme();
  return (summary: DaySummary, day: string): string => {
    if (!summary.total || day > today()) return theme.surfaceMuted;
    if (summary.ratio >= 1) return theme.primary;
    if (summary.ratio >= 0.66) return `${theme.primary}B3`;
    if (summary.ratio >= 0.33) return `${theme.primary}73`;
    if (summary.ratio > 0) return `${theme.primary}38`;
    return theme.dangerSoft;
  };
}

/** The most notable special day (Ramadan is a whole month, so it comes last). */
function mainSpecial(day: string): SpecialDay | null {
  const list = specialDays(day);
  return (
    list.find((item) => item !== 'ramadan' && item !== 'whiteDay') ??
    list.find((item) => item === 'whiteDay') ??
    (list.includes('ramadan') ? 'ramadan' : null)
  );
}

/** Names of the special days in a list of days, for the month footer. */
function specialList(days: string[]): { day: string; kind: SpecialDay }[] {
  const seen = new Set<string>();
  const result: { day: string; kind: SpecialDay }[] = [];
  for (const day of days) {
    for (const kind of specialDays(day)) {
      // One line for Ramadan, the White Days and Ashura: their first day.
      if ((kind === 'ramadan' || kind === 'whiteDay' || kind === 'tashriq' || kind === 'ashura') && seen.has(kind))
        continue;
      seen.add(kind);
      result.push({ day, kind });
    }
  }
  return result;
}

export function HeatLegend() {
  const { t } = useTranslation();
  const theme = useTheme();
  const steps = [
    { color: theme.dangerSoft, label: t('calendar.legend.none') },
    { color: `${theme.primary}38`, label: '' },
    { color: `${theme.primary}73`, label: '' },
    { color: `${theme.primary}B3`, label: '' },
    { color: theme.primary, label: t('calendar.legend.all') },
  ];
  return (
    <View style={styles.legend}>
      <AppText variant="caption" color="textSecondary">
        {steps[0].label}
      </AppText>
      {steps.map((step, index) => (
        <View key={index} style={[styles.legendCell, { backgroundColor: step.color, borderColor: theme.border }]} />
      ))}
      <AppText variant="caption" color="textSecondary">
        {steps[4].label}
      </AppText>
      <View style={[styles.legendCell, styles.ramadanCell, { borderColor: theme.accent }]} />
      <AppText variant="caption" color="textSecondary">
        {t('calendar.special.ramadan')}
      </AppText>
    </View>
  );
}

function StateMark({ item }: { item: DayTask }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const color: Record<TaskState, string> = {
    done: theme.primary,
    partial: theme.accent,
    missed: theme.danger,
    open: theme.textSecondary,
    upcoming: theme.textSecondary,
  };
  return (
    <View style={styles.state}>
      {item.state === 'done' ? <CheckIcon size={16} color={theme.primary} /> : null}
      <AppText variant="caption" weight="semibold" style={{ color: color[item.state] }}>
        {item.state === 'partial'
          ? format.digits(`${Math.round(item.ratio * 100)}%`)
          : t(`calendar.states.${item.state}`)}
      </AppText>
    </View>
  );
}

/** One day: Hijri date, prayer times (tick today's), tasks of the day and of its week / month / year. */
export function DayView({ day, tasks, prayer }: { day: string; tasks: Task[]; prayer: PrayerSettings }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { time: clock } = usePrayerFormat();
  const { format } = useLedgerLabels();
  const times = prayerTimes(prayer, day);
  const items = dayTasks(tasks, day).filter((item) => item.task.kind !== 'prayer');
  const periods = periodTasks(tasks, day);
  const now = new Date();

  return (
    <>
      <AppText variant="caption" color="textSecondary" align="center">
        {format.digits(hijri(day, i18n.language, 'long'))}
      </AppText>
      {specialDays(day).length ? (
        <Card tone="accent">
          <AppText variant="label" weight="semibold" align="center">
            {specialDays(day)
              .map((kind) => t(`calendar.special.${kind}`))
              .join(' · ')}
          </AppText>
        </Card>
      ) : null}

      {times ? (
        <Section title={t('calendar.prayers')}>
          <Card>
            {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((name, index) => {
              const isPrayer = name !== 'sunrise';
              const state = isPrayer && prayer.tasks ? prayerState(name, day, now) : null;
              const prayed = state === 'prayed' || state === 'combined' || state === 'late';
              const missed = state === 'missed';
              const markColor =
                state === 'late'
                  ? theme.prayerLate
                  : state === 'combined'
                    ? theme.prayerCombined
                    : state === 'prayed'
                      ? theme.primary
                      : missed
                        ? theme.danger
                        : null;
              // Past days can be corrected (a forgotten mark): the hisab entry is rewritten.
              const canCheck = isPrayer && prayer.tasks && canMarkPrayer(name, day, now);
              return (
                <Fragment key={name}>
                  {index > 0 ? <Divider /> : null}
                  <Row
                    title={t(`prayer.names.${name}`)}
                    subtitle={state ? t(`prayer.states.${state}`) : undefined}
                    value={clock(times[name])}
                    valueColor={name === 'sunrise' ? 'textSecondary' : 'text'}
                    onPress={canCheck ? () => openPrayerSheet(name, day) : undefined}
                    end={
                      isPrayer && prayer.tasks ? (
                        <View
                          style={[
                            styles.check,
                            {
                              borderColor: markColor ?? theme.border,
                              backgroundColor: markColor ?? 'transparent',
                            },
                          ]}>
                          {prayed ? <CheckIcon size={14} color={theme.textOnPrimary} /> : null}
                          {missed ? (
                            <AppText
                              variant="caption"
                              weight="bold"
                              style={{ color: theme.textOnPrimary, lineHeight: 16 }}>
                              ✕
                            </AppText>
                          ) : null}
                        </View>
                      ) : undefined
                    }
                  />
                </Fragment>
              );
            })}
          </Card>
        </Section>
      ) : (
        <Card>
          <AppText variant="caption" color="textSecondary" align="center">
            {t('calendar.noLocation')}
          </AppText>
        </Card>
      )}

      <Section title={t('calendar.tasks')}>
        <Card>
          {items.length ? (
            items.map((item, index) => (
              <Fragment key={item.task.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  title={item.task.title}
                  subtitle={t(`task.kinds.${item.task.kind}`)}
                  end={<StateMark item={item} />}
                  onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.task.id } })}
                />
              </Fragment>
            ))
          ) : (
            <AppText variant="caption" color="textSecondary" align="center">
              {t('calendar.noTasks')}
            </AppText>
          )}
        </Card>
      </Section>

      {periods.length ? (
        <Section title={t('calendar.periodTasks')}>
          <Card>
            {periods.map((item, index) => (
              <Fragment key={item.task.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  title={item.task.title}
                  subtitle={`${t(`task.repeats.${item.task.repeat.kind}`)} · ${t('calendar.until', { date: format.day(item.end) })}`}
                  end={<StateMark item={item} />}
                  onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.task.id } })}
                />
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

/** Seven rows (Saturday → Friday): date, Hijri date, tasks done and the five prayer times. */
export function WeekView({
  day,
  tasks,
  prayer,
  onOpenDay,
}: {
  day: string;
  tasks: Task[];
  prayer: PrayerSettings;
  onOpenDay: (day: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const { time: clock } = usePrayerFormat();
  const heat = useHeat();

  return (
    <Card>
      {weekDays(day).map((date, index) => {
        const summary = summarize(dayTasks(tasks, date));
        const times = prayerTimes(prayer, date);
        const isToday = date === today();
        return (
          <Fragment key={date}>
            {index > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenDay(date)}
              style={({ pressed }) => [styles.weekRow, pressed && { backgroundColor: theme.surfaceMuted }]}>
              <View
                style={[
                  styles.weekDate,
                  { backgroundColor: heat(summary, date), borderColor: isToday ? theme.accent : 'transparent' },
                ]}>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{
                    color: summary.total && summary.ratio >= 0.66 && date <= today() ? theme.textOnPrimary : theme.text,
                  }}>
                  {t(`task.days.${weekOrder()[index]}`)}
                </AppText>
                <AppText
                  variant="heading"
                  weight="bold"
                  style={{
                    color: summary.total && summary.ratio >= 0.66 && date <= today() ? theme.textOnPrimary : theme.text,
                  }}>
                  {format.number(Number(date.slice(8)))}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  {format.digits(hijri(date, i18n.language, 'long'))}
                  {mainSpecial(date) ? ` · ${t(`calendar.special.${mainSpecial(date)}`)}` : ''}
                </AppText>
                <AppText variant="label">
                  {summary.total
                    ? t('calendar.doneOf', { done: format.number(summary.done), total: format.number(summary.total) })
                    : t('calendar.noTasksShort')}
                </AppText>
                {times ? (
                  <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                    {PRAYERS.map((name) => clock(times[name])).join('  ')}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          </Fragment>
        );
      })}
    </Card>
  );
}

/** Month grid; tap a day to see it below. */
export function MonthView({
  month,
  selected,
  tasks,
  onSelect,
}: {
  month: string;
  selected: string;
  tasks: Task[];
  onSelect: (day: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const heat = useHeat();
  const now = today();

  return (
    <Card>
      <AppText variant="caption" color="textSecondary" align="center">
        {format.digits(hijri(`${month}-01`, i18n.language, 'month'))}
        {' – '}
        {format.digits(hijri(monthGrid(month).flat().filter(Boolean).pop()!, i18n.language, 'month'))}
      </AppText>
      <View style={styles.gridRow}>
        {weekOrder().map((weekdayNumber) => (
          <AppText key={weekdayNumber} variant="caption" color="textSecondary" align="center" style={styles.gridCell}>
            {t(`task.days.${weekdayNumber}`)}
          </AppText>
        ))}
      </View>
      {monthGrid(month).map((week, index) => (
        <View key={index} style={styles.gridRow}>
          {week.map((date, cell) => {
            if (!date) return <View key={cell} style={styles.gridCell} />;
            const summary = summarize(dayTasks(tasks, date));
            const background = heat(summary, date);
            const strong = summary.total > 0 && summary.ratio >= 0.66 && date <= now;
            const isSelected = date === selected;
            const special = mainSpecial(date);
            const ramadan = specialDays(date).includes('ramadan');
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${format.day(date, 'long')}: ${t('calendar.doneOf', {
                  done: format.number(summary.done),
                  total: format.number(summary.total),
                })}`}
                onPress={() => onSelect(date)}
                style={[
                  styles.gridCell,
                  styles.dayCell,
                  {
                    backgroundColor: background,
                    borderColor: isSelected ? theme.text : date === now || ramadan ? theme.accent : 'transparent',
                    borderStyle: ramadan && !isSelected && date !== now ? 'dashed' : 'solid',
                  },
                ]}>
                {special && special !== 'ramadan' ? (
                  <View style={[styles.specialDot, { backgroundColor: theme.accent }]} />
                ) : null}
                <AppText variant="label" weight="semibold" style={{ color: strong ? theme.textOnPrimary : theme.text }}>
                  {format.number(Number(date.slice(8)))}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: strong ? theme.textOnPrimary : theme.textSecondary, fontSize: 10 }}>
                  {format.digits(hijri(date, i18n.language, 'day'))}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
      <HeatLegend />
      {specialList(
        monthGrid(month)
          .flat()
          .filter((d): d is string => !!d),
      ).map(({ day, kind }) => (
        <Pressable
          key={`${kind}-${day}`}
          accessibilityRole="button"
          onPress={() => onSelect(day)}
          style={styles.specialRow}>
          <View style={[styles.specialDot, styles.specialDotInline, { backgroundColor: theme.accent }]} />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            {t(`calendar.special.${kind}`)}
          </AppText>
          <AppText variant="caption" weight="semibold">
            {format.day(day)}
          </AppText>
        </Pressable>
      ))}
    </Card>
  );
}

/** Twelve small months; each day coloured by how much was done. Tap a month to open it. */
export function YearView({
  year,
  tasks,
  onOpenMonth,
}: {
  year: string;
  tasks: Task[];
  onOpenMonth: (month: string) => void;
}) {
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const heat = useHeat();
  const now = today();

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const weeks = monthGrid(month).map((week) =>
      week.map((date) => (date ? { date, summary: summarize(dayTasks(tasks, date)) } : null)),
    );
    const past = weeks.flat().filter((cell) => cell && cell.date <= now) as { date: string; summary: DaySummary }[];
    const done = past.reduce((sum, cell) => sum + cell.summary.done, 0);
    const total = past.reduce((sum, cell) => sum + cell.summary.total, 0);
    return { month, weeks, done, total };
  });

  return (
    <>
      <View style={styles.yearGrid}>
        {months.map(({ month, weeks, done, total }) => {
          return (
            <Pressable
              key={month}
              accessibilityRole="button"
              onPress={() => onOpenMonth(month)}
              style={({ pressed }) => [
                styles.miniMonth,
                {
                  backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                  borderColor: month === now.slice(0, 7) ? theme.accent : theme.border,
                },
              ]}>
              <AppText variant="caption" weight="semibold" numberOfLines={1}>
                {format.month(month).split(' ')[0]}
              </AppText>
              {weeks.map((week, row) => (
                <View key={row} style={styles.miniRow}>
                  {week.map((cell, index) =>
                    cell ? (
                      <View
                        key={cell.date}
                        style={[
                          styles.miniCell,
                          { backgroundColor: heat(cell.summary, cell.date) },
                          specialDays(cell.date).includes('ramadan') && { borderWidth: 1, borderColor: theme.accent },
                        ]}
                      />
                    ) : (
                      <View key={index} style={styles.miniCell} />
                    ),
                  )}
                </View>
              ))}
              <AppText variant="caption" color="textSecondary" style={styles.miniFooter}>
                {total ? format.digits(`${Math.round((done / total) * 100)}%`) : ' '}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <HeatLegend />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: Spacing.two },
  legendCell: { width: 14, height: 14, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth },
  state: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  weekDate: {
    width: 52,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderRadius: Radius.small,
    borderWidth: 2,
  },
  // The grid always runs Saturday → Friday, right to left in Arabic like printed calendars.
  gridRow: { flexDirection: 'row', gap: 3, marginTop: 3 },
  gridCell: { flex: 1 },
  dayCell: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderWidth: 2,
  },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  miniMonth: {
    flexBasis: '30%',
    flexGrow: 1,
    padding: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: 1,
    gap: 2,
  },
  miniRow: { flexDirection: 'row', gap: 2 },
  miniCell: { flex: 1, aspectRatio: 1, borderRadius: 2 },
  miniFooter: { marginTop: 2 },
  ramadanCell: { borderWidth: 2, borderStyle: 'dashed', backgroundColor: 'transparent' },
  specialDot: { position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: 3 },
  specialDotInline: { position: 'relative', top: 0, right: 0 },
  specialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4 },
});
