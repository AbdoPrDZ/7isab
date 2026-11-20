import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { BackIcon } from '@/components/ui/icons';
import { AmountInput, Card, Chips, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { addDays, daysBetween, today } from '@/lib/dates';
import { useDoc } from '@/lib/data/vault';
import { parseAmount } from '@/lib/format';
import { useLedgerLabels, useTasks } from '@/lib/ledger/hooks';
import { RecordTypes, type Program, type ProgramCategory } from '@/lib/ledger/types';
import {
  deleteProgram,
  deleteRelapse,
  endFromLength,
  logRelapse,
  programWholeRange,
  saveProgram,
  streaks,
  useCategoryLabel,
  useProgramReport,
  useRelapses,
} from '@/lib/programs/programs';
import { reportRange, shiftReport } from '@/lib/reports/reports';

const CATEGORIES: ProgramCategory[] = ['improving', 'healing', 'custom'];
/** Length in days; 0 = open-ended, -1 = typed by the user. */
const LENGTHS = [0, 7, 30, 40, 60, 90, -1];

type ReportView = 'whole' | 'week' | 'month';

function ProgramForm({ existing }: { existing?: Program }) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<ProgramCategory>(existing?.category ?? 'improving');
  const [customCategory, setCustomCategory] = useState(existing?.customCategory ?? '');
  const [goal, setGoal] = useState(existing?.goal ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today());
  const existingLength = existing?.endDate ? daysBetween(existing.startDate, existing.endDate).length : 0;
  const [length, setLength] = useState(LENGTHS.includes(existingLength) ? existingLength : -1);
  const [customLength, setCustomLength] = useState(existingLength ? String(existingLength) : '21');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError(t('common.nameRequired'));
    const days = length === -1 ? parseAmount(customLength) : length;
    if (days === null || days < 0 || !Number.isInteger(days)) return setError(t('programs.invalidLength'));
    setSaving(true);
    const saved = await saveProgram({
      id: existing?.id,
      name: name.trim(),
      category,
      customCategory: category === 'custom' ? customCategory.trim() || undefined : undefined,
      goal: goal.trim() || undefined,
      startDate,
      endDate: days > 0 ? endFromLength(startDate, days) : null,
      archived: existing?.archived,
    });
    if (existing) router.back();
    else router.replace(`/program/${saved.id}`);
  };

  return (
    <>
      <TextField label={t('programs.name')} placeholder={t('programs.namePlaceholder')} value={name} onChangeText={setName} error={error} />

      <Section title={t('programs.category')}>
        <Chips
          options={CATEGORIES.map((value) => ({ value, label: t(`programs.categories.${value}`) }))}
          value={category}
          onChange={setCategory}
        />
        {category === 'custom' ? (
          <TextField label={t('programs.customCategory')} value={customCategory} onChangeText={setCustomCategory} />
        ) : null}
        <AppText variant="caption" color="textSecondary">
          {t(`programs.categoryHints.${category}`)}
        </AppText>
      </Section>

      <TextField label={t('programs.goal')} placeholder={t('programs.goalPlaceholder')} value={goal} onChangeText={setGoal} multiline />

      {existing ? null : (
        <Section title={t('programs.start')}>
          <Chips
            options={[
              { value: today(), label: t('programs.startToday') },
              { value: addDays(today(), 1), label: t('programs.startTomorrow') },
            ]}
            value={startDate}
            onChange={setStartDate}
          />
        </Section>
      )}

      <Section title={t('programs.length')}>
        <Chips
          options={LENGTHS.map((value) => ({
            value,
            label:
              value === 0
                ? t('programs.openEnded')
                : value === -1
                  ? t('programs.otherLength')
                  : t('programs.days', { count: value, days: format.number(value) }),
          }))}
          value={length}
          onChange={setLength}
        />
        {length === -1 ? (
          <AmountInput label={t('programs.lengthDays')} value={customLength} onChangeText={setCustomLength} suffix={t('programs.daysUnit')} />
        ) : null}
      </Section>

      <Button title={t('common.save')} loading={saving} onPress={() => void save()} />
    </>
  );
}

function HealingCard({ program }: { program: Program }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const relapses = useRelapses(program.id);
  const { current, best } = streaks(program, relapses);
  const [logging, setLogging] = useState(false);
  const [note, setNote] = useState('');
  const [thanb, setThanb] = useState(true);
  const [date, setDate] = useState(today());

  const log = async () => {
    await logRelapse(program, date, note, thanb);
    setLogging(false);
    setNote('');
  };

  const remove = (id: string) => {
    const relapse = relapses.find((item) => item.id === id);
    if (!relapse) return;
    Alert.alert(t('common.delete'), t('programs.deleteRelapse'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteRelapse(relapse) },
    ]);
  };

  return (
    <Section title={t('programs.healing')}>
      <View style={styles.streaks}>
        <View style={[styles.streak, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
          <AppText variant="title" color="primary" align="center">
            {format.number(current)}
          </AppText>
          <AppText variant="caption" align="center">
            {t('programs.currentStreak')}
          </AppText>
        </View>
        <View style={[styles.streak, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="title" align="center">
            {format.number(best)}
          </AppText>
          <AppText variant="caption" align="center">
            {t('programs.bestStreak')}
          </AppText>
        </View>
      </View>

      {logging ? (
        <Card>
          <Chips
            options={[
              { value: today(), label: t('programs.startToday') },
              { value: addDays(today(), -1), label: t('programs.yesterday') },
            ]}
            value={date}
            onChange={setDate}
          />
          <TextField label={t('programs.relapseNote')} placeholder={t('programs.relapseNotePlaceholder')} value={note} onChangeText={setNote} />
          <SwitchRow label={t('programs.relapseThanb')} hint={t('programs.relapseThanbHint')} value={thanb} onChange={setThanb} />
          <Button title={t('programs.saveRelapse')} onPress={() => void log()} />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setLogging(false)} />
        </Card>
      ) : (
        <Button title={t('programs.logRelapse')} variant="secondary" onPress={() => setLogging(true)} />
      )}

      {relapses.length ? (
        <Card>
          {relapses.map((relapse, index) => (
            <Fragment key={relapse.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable onLongPress={() => remove(relapse.id)}>
                <Row
                  title={format.day(relapse.date, 'long')}
                  subtitle={relapse.note}
                  value={relapse.thanb ? t('reasons.countsThanb') : undefined}
                  valueColor="danger"
                />
              </Pressable>
            </Fragment>
          ))}
        </Card>
      ) : null}
      <AppText variant="caption" color="textSecondary">
        {t('programs.relapseHint')}
      </AppText>
    </Section>
  );
}

function ProgramReportCard({ program }: { program: Program }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const { format } = useLedgerLabels();
  const [view, setView] = useState<ReportView>('whole');
  const [day, setDay] = useState(today());
  const range = view === 'whole' ? programWholeRange(program) : reportRange(view, day);
  const report = useProgramReport(program, range.start, range.end);
  if (!report) return null;

  const label =
    view === 'whole'
      ? t('programs.wholeSoFar')
      : view === 'week'
        ? `${format.day(range.start)} – ${format.day(range.end)}`
        : format.month(range.start.slice(0, 7));

  return (
    <Section title={t('programs.report')}>
      <Chips
        options={(['whole', 'week', 'month'] as ReportView[]).map((value) => ({ value, label: t(`programs.views.${value}`) }))}
        value={view}
        onChange={setView}
      />
      {view === 'whole' ? null : (
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(shiftReport(view, day, -1))}>
            <BackIcon size={20} color={theme.primary} flip={isRtl} />
          </Pressable>
          <AppText variant="label" weight="semibold" align="center" style={styles.flex}>
            {label}
          </AppText>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setDay(shiftReport(view, day, 1))}>
            <BackIcon size={20} color={theme.primary} flip={!isRtl} />
          </Pressable>
        </View>
      )}
      <Card>
        <AppText variant="heading" align="center">
          {report.rating ? t(`report.ratings.${report.rating}`) : t('report.noData')}
        </AppText>
        {report.score !== null ? (
          <AppText variant="label" align="center">
            {t('report.scoreLine', {
              score: format.digits(`${Math.round(report.score * 100)}%`),
              done: format.number(report.completed, 1),
              items: format.number(report.items + report.relapses),
            })}
          </AppText>
        ) : null}
        {program.category === 'healing' ? (
          <AppText variant="caption" color="textSecondary" align="center">
            {t('programs.relapsesIn', { count: report.relapses, relapses: format.number(report.relapses) })}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textSecondary" align="center">
          {t('report.estimate')}
        </AppText>
      </Card>
      {report.rows.length ? (
        <Card>
          {report.rows.map((row, index) => (
            <Fragment key={row.task.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                title={row.task.title}
                value={`${format.number(row.done, 1)} / ${format.number(row.total)}`}
                valueColor={row.done >= row.total ? 'primary' : row.done === 0 ? 'danger' : 'text'}
              />
            </Fragment>
          ))}
        </Card>
      ) : null}
    </Section>
  );
}

/** Create, edit and follow a program: its healing streak, its report and its tasks. */
export default function ProgramScreen() {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = useDoc<Program>(RecordTypes.program, id === 'new' ? undefined : id);
  const tasks = useTasks().filter((task) => program && task.programId === program.id);
  const categoryLabel = useCategoryLabel();
  const [editing, setEditing] = useState(false);

  if (id === 'new') {
    return (
      <Screen back title={t('programs.new')}>
        <ProgramForm />
      </Screen>
    );
  }
  if (!program) {
    return (
      <Screen back title={t('programs.title')}>
        <AppText variant="label" color="textSecondary" align="center">
          {t('programs.notFound')}
        </AppText>
      </Screen>
    );
  }
  if (editing) {
    return (
      <Screen back title={t('programs.edit')}>
        <ProgramForm existing={program} />
        <Button title={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} />
      </Screen>
    );
  }

  const remove = () =>
    Alert.alert(t('common.delete'), t('programs.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteProgram(program).then(() => router.back()) },
    ]);

  const dates = program.endDate
    ? t('programs.fromTo', { from: format.day(program.startDate), to: format.day(program.endDate) })
    : t('programs.from', { from: format.day(program.startDate) });

  return (
    <Screen back title={program.name} subtitle={`${categoryLabel(program)} · ${dates}`}>
      {program.goal ? (
        <Card>
          <AppText variant="label">{program.goal}</AppText>
        </Card>
      ) : null}

      {program.category === 'healing' ? <HealingCard program={program} /> : null}

      <ProgramReportCard program={program} />

      <Section title={t('programs.tasks')}>
        <Card>
          {tasks.length ? (
            tasks.map((task, index) => (
              <Fragment key={task.id}>
                {index > 0 ? <Divider /> : null}
                <Row
                  title={task.title}
                  subtitle={task.archived ? t('programs.archivedTask') : t(`task.kinds.${task.kind}`)}
                  chevron
                  onPress={() => router.push(`/task/${task.id}`)}
                />
              </Fragment>
            ))
          ) : (
            <AppText variant="label" color="textSecondary" align="center">
              {t('programs.noTasks')}
            </AppText>
          )}
        </Card>
        <Button title={t('programs.addTask')} variant="secondary" onPress={() => router.push(`/task/new?program=${program.id}`)} />
      </Section>

      <View style={styles.actions}>
        <Button title={t('programs.edit')} variant="secondary" style={styles.flex} onPress={() => setEditing(true)} />
        <Button
          title={program.archived ? t('programs.reopen') : t('programs.finish')}
          variant="secondary"
          style={styles.flex}
          onPress={() => void saveProgram({ ...program, archived: !program.archived })}
        />
      </View>
      <Button title={t('common.delete')} variant="ghost" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  streaks: { flexDirection: 'row', gap: Spacing.three },
  streak: { flex: 1, borderRadius: Radius.large, borderWidth: 1, padding: Spacing.three, gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
