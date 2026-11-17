import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AmountInput, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { today } from '@/lib/dates';
import { useDoc, useDocs } from '@/lib/data/vault';
import { parseAmount } from '@/lib/format';
import { FASTING_PRESETS, fastingRepeat, NAFILAH_RAKAHS, NAFILAH_TYPES } from '@/lib/ledger/presets';
import { archiveTask, deleteTask, saveTask } from '@/lib/ledger/tasks';
import {
  RecordTypes,
  type FastingPreset,
  type NafilahType,
  type Task,
  type TaskKind,
  type TaskRepeat,
  type TaskTarget,
} from '@/lib/ledger/types';
import { ATHKAR_LIST_IDS, type AthkarListId } from '@/lib/athkar/data';

const KINDS: TaskKind[] = ['quran', 'athkar', 'nafilah', 'fasting', 'custom'];
const REPEATS: BasicRepeat[] = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'];
const UNITS_BY_KIND: Record<TaskKind, TaskTarget['unit'][]> = {
  quran: ['hizb', 'rub', 'thumn', 'pages', 'words', 'check'],
  athkar: ['count', 'check'],
  custom: ['check', 'count'],
  prayer: ['check'],
  nafilah: ['rakahs', 'check'],
  fasting: ['check'],
};

type BasicRepeat = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export default function TaskEditorScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useDoc<Task>(RecordTypes.task, id === 'new' ? undefined : id);
  useDocs<Task>(RecordTypes.task);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [kind, setKind] = useState<TaskKind>(existing?.kind ?? 'custom');
  const [unit, setUnit] = useState<TaskTarget['unit']>(existing?.target.unit ?? 'check');
  const [amount, setAmount] = useState(String(existing?.target.amount ?? 1));
  const existingRepeat = existing?.repeat.kind;
  const [repeatKind, setRepeatKind] = useState<BasicRepeat>(
    existingRepeat && existingRepeat !== 'hijri' && existingRepeat !== 'hijriMonth' ? existingRepeat : 'daily',
  );
  const [nafilah, setNafilah] = useState<NafilahType>(existing?.nafilah ?? 'rawatib');
  const [fasting, setFasting] = useState<FastingPreset>(existing?.fasting ?? 'ramadan');
  const [days, setDays] = useState<number[]>(existing?.repeat.kind === 'weekdays' ? existing.repeat.days : [5]);
  const [reward, setReward] = useState(String(existing?.reward ?? 1));
  const [penalty, setPenalty] = useState(String(existing?.penalty ?? 1));
  const [athkarList, setAthkarList] = useState<AthkarListId>((existing?.athkarListId as AthkarListId) ?? 'morning');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Suggested names follow the chosen preset until the user types their own.
  const suggested = [
    ...NAFILAH_TYPES.map((value) => t(`task.nafilah.${value}`)),
    ...FASTING_PRESETS.map((value) => t(`task.fastingPresets.${value}`)),
  ];
  const suggestTitle = (text: string) => {
    if (!title.trim() || suggested.includes(title.trim())) setTitle(text);
  };

  const chooseNafilah = (next: NafilahType) => {
    setNafilah(next);
    setUnit('rakahs');
    setAmount(String(NAFILAH_RAKAHS[next]));
    suggestTitle(t(`task.nafilah.${next}`));
  };

  const chooseFasting = (next: FastingPreset) => {
    setFasting(next);
    setUnit(next === 'shawwal' ? 'days' : 'check');
    setAmount(next === 'shawwal' ? '6' : '1');
    suggestTitle(t(`task.fastingPresets.${next}`));
  };

  const changeKind = (next: TaskKind) => {
    setKind(next);
    if (next === 'nafilah') return chooseNafilah(nafilah);
    if (next === 'fasting') return chooseFasting(fasting);
    if (!UNITS_BY_KIND[next].includes(unit)) setUnit(UNITS_BY_KIND[next][0]);
  };

  const presetRepeat = kind === 'fasting' ? fastingRepeat(fasting) : null;
  const buildRepeat = (): TaskRepeat => {
    if (presetRepeat) return presetRepeat;
    if (repeatKind === 'weekdays') return { kind: 'weekdays', days: [...days].sort() };
    return { kind: repeatKind };
  };

  const save = async () => {
    const targetAmount = unit === 'check' ? 1 : parseAmount(amount);
    const rewardValue = parseAmount(reward);
    const penaltyValue = parseAmount(penalty);
    if (!title.trim()) return setError(t('common.nameRequired'));
    if (!targetAmount || targetAmount <= 0 || rewardValue === null || penaltyValue === null)
      return setError(t('common.invalidAmount'));
    if (!presetRepeat && repeatKind === 'weekdays' && !days.length) return setError(t('task.noDays'));

    setSaving(true);
    await saveTask({
      id: existing?.id,
      title: title.trim(),
      kind,
      target: { unit, amount: targetAmount },
      repeat: buildRepeat(),
      reward: rewardValue,
      penalty: penaltyValue,
      startDate: existing?.startDate ?? today(),
      archived: existing?.archived,
      athkarListId: kind === 'athkar' ? athkarList : undefined,
      prayer: existing?.prayer,
      nafilah: kind === 'nafilah' ? nafilah : undefined,
      fasting: kind === 'fasting' ? fasting : undefined,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void deleteTask(existing).then(() => router.back()),
      },
    ]);
  };

  return (
    <Screen
      back
      title={existing ? t('task.editTitle') : t('task.newTitle')}
      footer={<Button title={t('common.save')} loading={saving} onPress={() => void save()} />}>
      <TextField
        label={t('task.name')}
        placeholder={t('task.namePlaceholder')}
        value={title}
        onChangeText={setTitle}
        error={error}
      />

      {kind !== 'prayer' ? (
        <Section title={t('task.kind')}>
          <Chips
            options={KINDS.map((value) => ({ value, label: t(`task.kinds.${value}`) }))}
            value={kind}
            onChange={changeKind}
          />
        </Section>
      ) : null}

      {kind === 'athkar' ? (
        <Section title={t('task.athkarList')}>
          <Chips
            options={ATHKAR_LIST_IDS.map((value) => ({ value, label: t(`athkar.lists.${value}`) }))}
            value={athkarList}
            onChange={setAthkarList}
          />
        </Section>
      ) : null}

      {kind === 'nafilah' ? (
        <Section title={t('task.nafilahType')}>
          <Chips
            options={NAFILAH_TYPES.map((value) => ({ value, label: t(`task.nafilah.${value}`) }))}
            value={nafilah}
            onChange={chooseNafilah}
          />
          <AppText variant="caption" color="textSecondary">
            {t(`task.nafilahHints.${nafilah}`)}
          </AppText>
        </Section>
      ) : null}

      {kind === 'fasting' ? (
        <Section title={t('task.fastingType')}>
          <Chips
            options={FASTING_PRESETS.map((value) => ({ value, label: t(`task.fastingPresets.${value}`) }))}
            value={fasting}
            onChange={chooseFasting}
          />
          <AppText variant="caption" color="textSecondary">
            {t(`task.fastingHints.${fasting}`)}
          </AppText>
        </Section>
      ) : null}

      {kind !== 'fasting' ? (
        <Section title={t('task.targetUnit')}>
          <Chips
            options={UNITS_BY_KIND[kind].map((value) => ({ value, label: t(`task.units.${value}`) }))}
            value={unit}
            onChange={setUnit}
          />
          {unit !== 'check' ? (
            <AmountInput
              label={t('task.amount')}
              value={amount}
              onChangeText={setAmount}
              suffix={t(`task.units.${unit}`)}
            />
          ) : null}
        </Section>
      ) : unit === 'days' ? (
        <AmountInput label={t('task.amount')} value={amount} onChangeText={setAmount} suffix={t('task.units.days')} />
      ) : null}

      {presetRepeat ? null : (
        <Section title={t('task.repeat')}>
          <Chips
            options={REPEATS.map((value) => ({ value, label: t(`task.repeats.${value}`) }))}
            value={repeatKind}
            onChange={setRepeatKind}
          />
          {repeatKind === 'weekly' || repeatKind === 'monthly' || repeatKind === 'yearly' ? (
            <AppText variant="caption" color="textSecondary">
              {t('task.periodRule')}
            </AppText>
          ) : null}
          {repeatKind === 'weekdays' ? (
            <Chips
              options={[0, 1, 2, 3, 4, 5, 6].map((value) => ({ value, label: t(`task.days.${value}`) }))}
              value={days}
              onChange={(day) =>
                setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))
              }
            />
          ) : null}
        </Section>
      )}

      <View style={styles.row}>
        <View style={styles.flex}>
          <AmountInput label={t('task.reward')} value={reward} onChangeText={setReward} />
        </View>
        {kind !== 'prayer' ? (
          <View style={styles.flex}>
            <AmountInput label={t('task.penalty')} value={penalty} onChangeText={setPenalty} />
          </View>
        ) : null}
      </View>
      {kind === 'prayer' ? (
        <AppText variant="caption" color="textSecondary">
          {t('task.prayerPenaltyHint')}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textSecondary">
        {t('task.rule')}
      </AppText>

      {existing ? (
        <View style={styles.row}>
          <Button
            title={t('common.archive')}
            variant="secondary"
            style={styles.flex}
            onPress={() => void archiveTask(existing).then(() => router.back())}
          />
          <Button title={t('common.delete')} variant="ghost" style={styles.flex} onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three },
  flex: { flex: 1 },
});
