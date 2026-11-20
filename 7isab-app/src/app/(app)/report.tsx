import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { BackIcon } from '@/components/ui/icons';
import { Card, Chips, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { monthOf, today } from '@/lib/dates';
import { useDocs } from '@/lib/data/vault';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { RecordTypes } from '@/lib/ledger/types';
import { programReport, usePrograms } from '@/lib/programs/programs';
import {
  REPORT_PERIODS,
  saveReportNote,
  shiftReport,
  useReport,
  useReportNote,
  type Rating,
  type Report,
  type ReportPeriod,
} from '@/lib/reports/reports';

function isPeriod(value: unknown): value is ReportPeriod {
  return typeof value === 'string' && (REPORT_PERIODS as string[]).includes(value);
}

function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** The report's private note: saved when the field loses focus. Keyed per report, so it starts from that report's note. */
function NoteField({ period, start }: { period: ReportPeriod; start: string }) {
  const { t } = useTranslation();
  const note = useReportNote(period, start);
  const [text, setText] = useState(note?.text ?? '');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (text.trim() === (note?.text ?? '')) return;
    await saveReportNote(period, start, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Section title={t('report.note')}>
      <TextField
        label={t('report.noteLabel')}
        placeholder={t('report.notePlaceholder')}
        value={text}
        onChangeText={setText}
        onBlur={() => void save()}
        multiline
        style={styles.note}
      />
      <AppText variant="caption" color={saved ? 'primary' : 'textSecondary'}>
        {saved ? t('report.noteSaved') : t('report.noteHint')}
      </AppText>
    </Section>
  );
}

function RatingCard({ report, previous }: { report: Report; previous: Report }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const tone: Record<Rating, { bg: string; border: string }> = {
    good: { bg: theme.primarySoft, border: theme.primary },
    normal: { bg: theme.prayerCombinedSoft, border: theme.prayerCombined },
    weak: { bg: theme.prayerLateSoft, border: theme.prayerLate },
  };
  const colors = report.rating ? tone[report.rating] : { bg: theme.surface, border: theme.border };
  const percent = (score: number) => format.digits(`${Math.round(score * 100)}%`);
  const delta =
    report.score !== null && previous.score !== null ? Math.round((report.score - previous.score) * 100) : null;

  return (
    <View style={[styles.rating, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {report.rating && report.score !== null ? (
        <>
          <AppText variant="title" align="center">
            {t(`report.ratings.${report.rating}`)}
          </AppText>
          <AppText variant="label" weight="semibold" align="center">
            {t('report.scoreLine', {
              score: percent(report.score),
              done: format.number(report.completed, 1),
              items: format.number(report.items),
            })}
          </AppText>
          {delta !== null ? (
            <AppText variant="caption" color="textSecondary" align="center">
              {delta === 0
                ? t('report.sameAsBefore')
                : t(delta > 0 ? 'report.betterBy' : 'report.worseBy', { points: format.digits(Math.abs(delta)) })}
            </AppText>
          ) : null}
        </>
      ) : (
        <AppText variant="label" color="textSecondary" align="center">
          {report.days ? t('report.noData') : t('report.notStarted')}
        </AppText>
      )}
      <AppText variant="caption" color="textSecondary" align="center">
        {t('report.estimate')}
      </AppText>
    </View>
  );
}

/** Day / week / month / year report: rating estimate, summary, tasks, and a private note. */
export default function ReportScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const { format } = useLedgerLabels();
  const params = useLocalSearchParams<{ period?: string; date?: string }>();
  const [period, setPeriod] = useState<ReportPeriod>(isPeriod(params.period) ? params.period : 'day');
  const [day, setDay] = useState(isDay(params.date) ? params.date : today());
  const { report, previous } = useReport(period, day);
  useDocs(RecordTypes.relapse);
  const programRows = usePrograms()
    .filter((program) => program.startDate <= report.end && (!program.endDate || program.endDate >= report.start))
    .map((program) => ({ program, result: programReport(program, report.start, report.end) }));

  const label =
    period === 'day'
      ? format.day(report.start, 'long')
      : period === 'week'
        ? `${format.day(report.start)} – ${format.day(report.end)}`
        : period === 'month'
          ? format.month(monthOf(report.start))
          : format.digits(report.start.slice(0, 4));

  const p = report.prayers;
  const prayerRows: [string, string][] = [
    [t('report.prayersOnTime'), format.number(p.onTime + p.combined)],
    [t('report.prayersLate'), format.number(p.late)],
    [t('report.prayersMissed'), format.number(p.missed)],
  ];
  if (p.mosque || p.home) {
    prayerRows.push([t('report.atMosque'), format.number(p.mosque)], [t('report.atHome'), format.number(p.home)]);
  }
  if (p.khushoo.good || p.khushoo.normal || p.khushoo.weak) {
    prayerRows.push([
      t('report.khushoo'),
      `${t('prayer.khushoo.good')} ${format.number(p.khushoo.good)} · ${t('prayer.khushoo.normal')} ${format.number(
        p.khushoo.normal,
      )} · ${t('prayer.khushoo.weak')} ${format.number(p.khushoo.weak)}`,
    ]);
  }
  if (p.jumuah.mosque || p.jumuah.home || p.jumuah.missed) {
    prayerRows.push([
      t('prayer.names.jumuah'),
      `${t('report.atMosque')} ${format.number(p.jumuah.mosque)} · ${t('report.atHome')} ${format.number(
        p.jumuah.home,
      )} · ${t('report.prayersMissed')} ${format.number(p.jumuah.missed)}`,
    ]);
  }

  const summary: [string, string, 'text' | 'primary' | 'danger'][] = [
    [t('report.akhira'), `+${format.points(report.earned)} / −${format.points(report.lost)}`, 'text'],
    [t('report.thanbAdded'), format.points(report.thanbAdded), report.thanbAdded ? 'danger' : 'text'],
    [t('report.sins'), format.number(report.sins + report.fastTaps), report.sins + report.fastTaps ? 'danger' : 'text'],
    [t('report.sadaqa'), format.number(report.sadaqa, 2), 'text'],
    [t('report.zakat'), format.number(report.zakat, 2), 'text'],
    [t('report.quran'), t('report.quranLine', { pages: format.number(report.quran.pages), words: format.number(report.quran.words) }), 'text'],
    [t('report.athkar'), format.number(report.athkar), 'text'],
  ];

  return (
    <Screen back title={t('report.title')}>
      <Chips
        options={REPORT_PERIODS.map((value) => ({ value, label: t(`report.periods.${value}`) }))}
        value={period}
        onChange={setPeriod}
      />

      <View style={styles.nav}>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(shiftReport(period, day, -1))}>
          <BackIcon size={22} color={theme.primary} flip={isRtl} />
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setDay(today())}>
          <AppText variant="heading" align="center">
            {label}
          </AppText>
          <AppText variant="caption" color="primary" align="center">
            {t('report.current')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(shiftReport(period, day, 1))}>
          <BackIcon size={22} color={theme.primary} flip={!isRtl} />
        </Pressable>
      </View>

      <RatingCard report={report} previous={previous} />

      <Section title={t('report.tasks')}>
        <Card>
          {report.tasks.length ? (
            report.tasks.map((row, index) => (
              <Fragment key={row.task.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  title={row.task.title}
                  value={`${format.number(row.done, 1)} / ${format.number(row.total)}`}
                  valueColor={row.done >= row.total ? 'primary' : row.done === 0 ? 'danger' : 'text'}
                />
              </Fragment>
            ))
          ) : (
            <AppText variant="label" color="textSecondary" align="center">
              {t('report.noTasks')}
            </AppText>
          )}
        </Card>
      </Section>

      {report.plain.rows.length ? (
        <Section title={t('stats.plainTasks')}>
          <Card>
            {report.plain.rows.map((row, index) => (
              <Fragment key={row.task.id}>
                {index > 0 ? <Divider /> : null}
                <Row title={row.task.title} value={`${format.number(row.done, 1)} / ${format.number(row.total)}`} />
              </Fragment>
            ))}
          </Card>
          <AppText variant="caption" color="textSecondary">
            {t('stats.plainHint')}
          </AppText>
        </Section>
      ) : null}

      <Section title={t('report.prayers')}>
        <Card>
          {prayerRows.map(([title, value], index) => (
            <Fragment key={title}>
              {index > 0 ? <Divider /> : null}
              <Row title={title} value={value} />
            </Fragment>
          ))}
        </Card>
      </Section>

      {report.bedtime ? (
        <Section title={t('bedtime.title')}>
          <Card>
            <Row title={t('bedtime.states.onTime')} value={format.number(report.bedtime.onTime)} valueColor="primary" />
            <Divider />
            <Row title={t('bedtime.states.late')} value={format.number(report.bedtime.late)} valueColor={report.bedtime.late ? 'danger' : 'text'} />
            <Divider />
            <Row title={t('report.excused')} value={format.number(report.bedtime.excused)} />
            <Divider />
            <Row
              title={t('bedtime.states.missed')}
              value={format.number(report.bedtime.missed)}
              valueColor={report.bedtime.missed ? 'danger' : 'text'}
            />
          </Card>
        </Section>
      ) : null}

      {programRows.length ? (
        <Section title={t('programs.title')}>
          <Card>
            {programRows.map(({ program, result }, index) => (
              <Fragment key={program.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  title={program.name}
                  subtitle={[
                    result.rating ? t(`report.ratings.${result.rating}`) : t('report.noData'),
                    ...(program.category === 'healing'
                      ? [t('programs.relapsesIn', { count: result.relapses, relapses: format.number(result.relapses) })]
                      : []),
                  ].join(' · ')}
                  value={result.score === null ? '—' : format.digits(`${Math.round(result.score * 100)}%`)}
                  chevron
                  onPress={() => router.push(`/program/${program.id}`)}
                />
              </Fragment>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={t('report.summary')}>
        <Card>
          {summary.map(([title, value, color], index) => (
            <Fragment key={title}>
              {index > 0 ? <Divider /> : null}
              <Row title={title} value={value} valueColor={color} />
            </Fragment>
          ))}
        </Card>
      </Section>

      <NoteField key={`${period}:${report.start}`} period={period} start={report.start} />

      {report.start <= today() && report.end >= today() ? null : (
        <Button title={t('report.goCurrent')} variant="ghost" onPress={() => setDay(today())} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rating: { borderRadius: Radius.large, borderWidth: 1, padding: Spacing.four, gap: Spacing.one },
  note: { minHeight: 96, textAlignVertical: 'top' },
});
