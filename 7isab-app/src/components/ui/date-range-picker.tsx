/**
 * Pick a from–to range on a month grid: tap the first day, then the last
 * (tapping before the first day starts again). Weeks start on Saturday.
 * `single`: picks one day (start = end).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { BackIcon } from '@/components/ui/icons';
import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { monthGrid, weekOrder } from '@/lib/calendar/calendar';
import { addMonths, monthOf, today } from '@/lib/dates';
import { useFormat } from '@/lib/format';

export function DateRangePicker({
  visible,
  start,
  end,
  onCancel,
  onConfirm,
  single = false,
  title,
}: {
  visible: boolean;
  start?: string;
  end?: string;
  onCancel: () => void;
  onConfirm: (start: string, end: string) => void;
  single?: boolean;
  /** Replaces the default "Pick a range" title. */
  title?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const { isRtl } = useDirection();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(monthOf(start ?? today()));
  const [from, setFrom] = useState<string | undefined>(start);
  const [to, setTo] = useState<string | undefined>(end);

  const tap = (day: string) => {
    if (single) {
      setFrom(day);
      setTo(day);
      return;
    }
    if (!from || to || day < from) {
      setFrom(day);
      setTo(undefined);
    } else setTo(day);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.flex}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onCancel} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <AppText variant="heading" align="center">
            {title ?? t('stats.range.pick')}
          </AppText>
          <AppText variant="caption" color="textSecondary" align="center">
            {single && from ? format.day(from, 'long') : from ? `${format.day(from, 'long')} → ${to ? format.day(to, 'long') : t('stats.range.pickEnd')}` : t('stats.range.pickStart')}
          </AppText>

          <View style={styles.nav}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setMonth(addMonths(month, -1))}>
              <BackIcon size={22} color={theme.primary} flip={isRtl} />
            </Pressable>
            <AppText variant="label" weight="semibold" align="center" style={styles.flex}>
              {format.month(month)}
            </AppText>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setMonth(addMonths(month, 1))}>
              <BackIcon size={22} color={theme.primary} flip={!isRtl} />
            </Pressable>
          </View>

          <View style={styles.week}>
            {weekOrder().map((day) => (
              <AppText key={day} variant="caption" color="textSecondary" align="center" style={styles.cell}>
                {t(`task.days.${day}`)}
              </AppText>
            ))}
          </View>
          {monthGrid(month).map((week, index) => (
            <View key={index} style={styles.week}>
              {week.map((day, cell) => {
                if (!day) return <View key={cell} style={styles.cell} />;
                const edge = day === from || day === to;
                const inside = !!from && !!to && day > from && day < to;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityState={{ selected: edge || inside }}
                    onPress={() => tap(day)}
                    style={[
                      styles.cell,
                      styles.day,
                      edge && { backgroundColor: theme.primary },
                      inside && { backgroundColor: theme.primarySoft },
                      day === today() && !edge && { borderColor: theme.accent, borderWidth: 1 },
                    ]}>
                    <AppText variant="label" color={edge ? 'textOnPrimary' : 'text'}>
                      {format.digits(Number(day.slice(8)))}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Button title={t('common.done')} disabled={!from} onPress={() => from && onConfirm(from, to ?? from)} />
          <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', aspectRatio: 1 },
  day: { borderRadius: Radius.small },
});
