/**
 * The statistics filter bar: period presets (with a custom range picker), the
 * range shown with its comparison, a Filters sheet (multi-select groups, text
 * search, saved filters) and chips for the active filters (tap to clear).
 */
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Chips } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';
import {
  activeFilterCount,
  EMPTY_FILTER,
  LIST_KEYS,
  RANGE_PRESETS,
  type ListKey,
  type RangePreset,
  type StatsFilter,
} from '@/lib/stats/filter';
import { deleteSavedFilter, saveFilter, useSavedFilters } from '@/lib/stats/panel';

import type { Panel } from './use-panel';

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function FilterSheet({
  visible,
  filter,
  panel,
  onChange,
  onClose,
}: {
  visible: boolean;
  filter: StatsFilter;
  panel: Panel;
  onChange: (filter: StatsFilter) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const saved = useSavedFilters();
  const [name, setName] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    await saveFilter(name, filter);
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.flex}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <AppText variant="heading" align="center">
              {t('stats.filters.title')}
            </AppText>

            {saved.length ? (
              <>
                <AppText variant="label" weight="semibold">
                  {t('stats.filters.saved')}
                </AppText>
                <View style={styles.wrap}>
                  {saved.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => onChange({ ...EMPTY_FILTER, ...item.filter })}
                      onLongPress={() =>
                        Alert.alert(t('common.delete'), item.name, [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('common.delete'), style: 'destructive', onPress: () => void deleteSavedFilter(item.id) },
                        ])
                      }
                      style={[styles.pill, { borderColor: theme.accent, backgroundColor: theme.surface }]}>
                      <AppText variant="label">{item.name}</AppText>
                    </Pressable>
                  ))}
                </View>
                <AppText variant="caption" color="textSecondary">
                  {t('stats.filters.savedHint')}
                </AppText>
              </>
            ) : null}

            <TextField
              label={t('stats.filters.search')}
              placeholder={t('stats.filters.searchPlaceholder')}
              value={filter.search}
              onChangeText={(search) => onChange({ ...filter, search })}
            />

            {LIST_KEYS.map((key) =>
              panel.options[key].length ? (
                <Fragment key={key}>
                  <AppText variant="label" weight="semibold">
                    {t(`stats.filters.${key}`)}
                    {filter[key].length ? ` · ${filter[key].length}` : ''}
                  </AppText>
                  <Chips
                    options={panel.options[key]}
                    value={filter[key] as string[]}
                    onChange={(value) => onChange({ ...filter, [key]: toggle(filter[key] as string[], value) })}
                  />
                </Fragment>
              ) : null,
            )}

            <View style={styles.saveRow}>
              <View style={styles.flex}>
                <TextField label={t('stats.filters.saveAs')} placeholder={t('stats.filters.saveName')} value={name} onChangeText={setName} />
              </View>
              <Button title={t('common.save')} variant="secondary" onPress={() => void save()} style={styles.saveButton} />
            </View>

            <Button
              title={t('stats.filters.clear')}
              variant="ghost"
              onPress={() => onChange({ ...EMPTY_FILTER, preset: filter.preset, start: filter.start, end: filter.end, groupBy: filter.groupBy })}
            />
            <Button title={t('common.done')} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function FilterBar({
  filter,
  panel,
  onChange,
}: {
  filter: StatsFilter;
  panel: Panel;
  onChange: (filter: StatsFilter) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const [sheet, setSheet] = useState(false);
  const [picking, setPicking] = useState(false);
  const count = activeFilterCount(filter);

  const choosePreset = (preset: RangePreset) => {
    if (preset === 'custom') setPicking(true);
    else onChange({ ...filter, preset });
  };

  const active: { key: ListKey; value: string; label: string }[] = LIST_KEYS.flatMap((key) =>
    (filter[key] as string[]).map((value) => ({
      key,
      value,
      label: panel.options[key].find((option) => option.value === value)?.label ?? value,
    })),
  );

  return (
    <>
      <Chips
        options={RANGE_PRESETS.map((value) => ({ value, label: t(`stats.range.${value}`) }))}
        value={filter.preset}
        onChange={choosePreset}
      />
      <View style={styles.rangeRow}>
        <View style={styles.flex}>
          <AppText variant="label" weight="semibold">
            {`${format.day(panel.range.start, 'long')} → ${format.day(panel.range.end, 'long')}`}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t('stats.range.vs', { from: format.day(panel.previous.start), to: format.day(panel.previous.end) })}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheet(true)}
          style={[
            styles.filterButton,
            { borderColor: count ? theme.primary : theme.border, backgroundColor: count ? theme.primarySoft : theme.surface },
          ]}>
          <AppText variant="label" weight="semibold" color={count ? 'primary' : 'text'}>
            {count ? t('stats.filters.buttonCount', { count: format.number(count) }) : t('stats.filters.button')}
          </AppText>
        </Pressable>
      </View>

      {active.length || filter.search.trim() ? (
        <View style={styles.wrap}>
          {filter.search.trim() ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange({ ...filter, search: '' })}
              style={[styles.pill, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>
              <AppText variant="caption" color="primary">{`“${filter.search.trim()}” ✕`}</AppText>
            </Pressable>
          ) : null}
          {active.map((item) => (
            <Pressable
              key={`${item.key}:${item.value}`}
              accessibilityRole="button"
              onPress={() => onChange({ ...filter, [item.key]: (filter[item.key] as string[]).filter((value) => value !== item.value) })}
              style={[styles.pill, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>
              <AppText variant="caption" color="primary">{`${item.label} ✕`}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FilterSheet visible={sheet} filter={filter} panel={panel} onChange={onChange} onClose={() => setSheet(false)} />
      {picking ? (
        <DateRangePicker
          visible
          start={filter.start ?? panel.range.start}
          end={filter.end ?? panel.range.end}
          onCancel={() => setPicking(false)}
          onConfirm={(start, end) => {
            setPicking(false);
            onChange({ ...filter, preset: 'custom', start, end });
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
  },
  content: { gap: Spacing.three },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { borderWidth: 1, borderRadius: Radius.large, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  filterButton: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  saveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  saveButton: { minHeight: 52 },
});
