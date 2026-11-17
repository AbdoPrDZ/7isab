import { useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { QURAN_FONT } from '@/components/quran/mushaf-page';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { AmountInput, Card, Divider, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addCustomDhikr,
  countDhikr,
  deleteCustomDhikr,
  resetDhikr,
  useAthkarCounts,
  useAthkarList,
} from '@/lib/athkar/athkar';
import { ATHKAR_LIST_IDS, type AthkarListId } from '@/lib/athkar/data';
import { parseAmount, useFormat } from '@/lib/format';

/** One athkar list: a big tap counter for the current dhikr, and the whole list below. */
export default function AthkarCounterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const params = useLocalSearchParams<{ list: string }>();
  const listId: AthkarListId = ATHKAR_LIST_IDS.includes(params.list as AthkarListId)
    ? (params.list as AthkarListId)
    : 'morning';
  const list = useAthkarList(listId);
  const counts = useAthkarCounts(listId);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('1');

  const firstOpen = list.find((dhikr) => (counts[dhikr.id] ?? 0) < dhikr.target);
  const current = list.find((dhikr) => dhikr.id === selected) ?? firstOpen ?? list[0];
  const count = current ? (counts[current.id] ?? 0) : 0;
  const complete = current ? count >= current.target : false;

  const tap = async () => {
    if (!current || complete) return;
    const next = await countDhikr(listId, current);
    // Move on to the next unfinished dhikr when this one is done.
    if (next >= current.target) setSelected(null);
  };

  const add = async () => {
    const times = parseAmount(target);
    if (!text.trim() || !times || times < 1) return;
    await addCustomDhikr(text.trim(), Math.round(times));
    setText('');
    setTarget('1');
  };

  return (
    <Screen back title={t(`athkar.lists.${listId}`)}>
      {current ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('athkar.tap')} onPress={() => void tap()}>
          {({ pressed }) => (
            <Card tone={complete ? 'accent' : 'surface'} style={[styles.counterCard, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.dhikr, { color: theme.text, fontFamily: QURAN_FONT }]}>{current.text}</Text>
              <View
                style={[
                  styles.circle,
                  { borderColor: theme.accent, backgroundColor: complete ? theme.accent : theme.primarySoft },
                ]}>
                {complete ? (
                  <CheckIcon size={40} color={theme.surface} />
                ) : (
                  <AppText variant="display" color="primary" align="center">
                    {format.digits(count)}
                  </AppText>
                )}
              </View>
              <AppText variant="label" color="textSecondary" align="center">
                {complete
                  ? t('athkar.completed')
                  : `${format.digits(count)} / ${format.digits(current.target)} · ${t('athkar.tap')}`}
              </AppText>
            </Card>
          )}
        </Pressable>
      ) : (
        <Card>
          <AppText variant="label" color="textSecondary" align="center">
            {t('athkar.empty')}
          </AppText>
        </Card>
      )}

      <Card>
        {list.map((dhikr, index) => {
          const value = counts[dhikr.id] ?? 0;
          const done = value >= dhikr.target;
          return (
            <Fragment key={dhikr.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => setSelected(dhikr.id)}
                onLongPress={() =>
                  Alert.alert(t(`athkar.lists.${listId}`), undefined, [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('athkar.reset'), onPress: () => void resetDhikr(listId, dhikr.id) },
                    ...(listId === 'custom'
                      ? [{ text: t('common.delete'), style: 'destructive' as const, onPress: () => void deleteCustomDhikr(dhikr.id) }]
                      : []),
                  ])
                }
                style={[styles.item, dhikr.id === current?.id && { backgroundColor: theme.primarySoft }]}>
                <Text numberOfLines={2} style={[styles.itemText, { color: theme.text, fontFamily: QURAN_FONT }]}>
                  {dhikr.text}
                </Text>
                <View style={[styles.badge, { backgroundColor: done ? theme.accent : theme.surfaceMuted }]}>
                  <AppText variant="caption" weight="semibold" color={done ? 'surface' : 'textSecondary'}>
                    {format.digits(value)}/{format.digits(dhikr.target)}
                  </AppText>
                </View>
              </Pressable>
            </Fragment>
          );
        })}
      </Card>

      {listId === 'custom' ? (
        <Section title={t('athkar.addDhikr')}>
          <TextField label={t('athkar.dhikrText')} value={text} onChangeText={setText} multiline />
          <AmountInput label={t('athkar.target')} value={target} onChangeText={setTarget} />
          <Button title={t('common.add')} variant="secondary" onPress={() => void add()} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counterCard: { alignItems: 'center', gap: Spacing.four, padding: Spacing.five },
  dhikr: { fontSize: 22, lineHeight: 44, textAlign: 'center', writingDirection: 'rtl' },
  circle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.small,
  },
  itemText: { flex: 1, fontSize: 16, lineHeight: 32, textAlign: 'right', writingDirection: 'rtl' },
  badge: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 2, minWidth: 52, alignItems: 'center' },
});
