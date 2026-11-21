/**
 * Small chart pieces for the statistics screen. Thin marks, rounded data ends
 * on the baseline, 2px gaps between fills, values always shown as text too
 * (so nothing is read from colour alone).
 */
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Headline number with an optional change against the previous period. */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  goodWhenUp = true,
  valueColor = 'text',
}: {
  label: string;
  value: string;
  /** Fraction (0.12 = +12%), or null to hide. */
  delta?: number | null;
  /** e.g. "vs last month"; the percentage is added before it. */
  deltaLabel?: (percent: string) => string;
  goodWhenUp?: boolean;
  valueColor?: 'text' | 'primary' | 'danger';
}) {
  const theme = useTheme();
  const showDelta = delta !== undefined && delta !== null && Number.isFinite(delta) && deltaLabel;
  const up = (delta ?? 0) >= 0;
  const good = up === goodWhenUp;
  const percent = showDelta ? `${up ? '▲' : '▼'} ${Math.round(Math.abs(delta!) * 100)}%` : '';

  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="heading" weight="bold" color={valueColor} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {showDelta ? (
        <AppText variant="caption" color={delta === 0 ? 'textSecondary' : good ? 'primary' : 'danger'} numberOfLines={1}>
          {deltaLabel!(percent)}
        </AppText>
      ) : null}
    </View>
  );
}

/** Two tiles per row. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** Name, figure and a bar against its own whole or limit. */
export function MeterRow({
  label,
  value,
  ratio,
  color,
  note,
  noteColor = 'textSecondary',
  swatch,
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
  note?: string;
  noteColor?: 'textSecondary' | 'danger' | 'primary';
  /** Small colour key before the name (matches a segmented bar above). */
  swatch?: string;
}) {
  const theme = useTheme();
  const width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` as const;
  return (
    <View style={styles.meter}>
      <View style={styles.meterLabel}>
        {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
        <AppText variant="label" style={styles.flex} numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="label" weight="semibold">
          {value}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
        <View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
      {note ? (
        <AppText variant="caption" color={noteColor}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

/** One whole split into parts (≤ 6), with 2px gaps between the parts. */
export function SegmentedBar({ parts }: { parts: { key: string; value: number; color: string }[] }) {
  const theme = useTheme();
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return null;
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surface }]}>
      {parts.map((part) => (
        <View key={part.key} style={{ flex: part.value / total, backgroundColor: part.color, minWidth: 3 }} />
      ))}
    </View>
  );
}

export type FlowPoint = { month: string; inflow: number; outflow: number };

/**
 * Two bars per month (in / out) on one axis. Tap a month to see its figures;
 * the selected month starts as the last one.
 */
export function FlowChart({
  data,
  inLabel,
  outLabel,
  formatValue,
  monthLabel,
  netLabel,
  inColor,
  outColor,
}: {
  data: FlowPoint[];
  inLabel: string;
  outLabel: string;
  formatValue: (value: number) => string;
  monthLabel: (month: string, short: boolean) => string;
  netLabel: string;
  /** Bar colours (default: income / expense colours). */
  inColor?: string;
  outColor?: string;
}) {
  const theme = useTheme();
  const inFill = inColor ?? theme.chartIn;
  const outFill = outColor ?? theme.chartOut;
  const [selected, setSelected] = useState(data.length - 1);
  const max = Math.max(1, ...data.flatMap((point) => [point.inflow, point.outflow]));
  const point = data[Math.min(selected, data.length - 1)];
  const narrow = data.length > 6;

  return (
    <View style={styles.flow}>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: inFill }]} />
        <AppText variant="caption" color="textSecondary">
          {inLabel}
        </AppText>
        <View style={[styles.legendDot, { backgroundColor: outFill }]} />
        <AppText variant="caption" color="textSecondary">
          {outLabel}
        </AppText>
      </View>

      <View style={styles.chart}>
        {data.map((item, index) => {
          const active = index === selected;
          return (
            <Pressable
              key={item.month}
              accessibilityRole="button"
              accessibilityLabel={`${monthLabel(item.month, false)}: ${inLabel} ${formatValue(item.inflow)}, ${outLabel} ${formatValue(item.outflow)}`}
              onPress={() => setSelected(index)}
              style={[styles.column, active && { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.bars, { borderBottomColor: theme.border }]}>
                <View
                  style={[
                    styles.bar,
                    narrow && styles.barNarrow,
                    { height: `${(item.inflow / max) * 100}%`, backgroundColor: inFill, opacity: active ? 1 : 0.75 },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    narrow && styles.barNarrow,
                    { height: `${(item.outflow / max) * 100}%`, backgroundColor: outFill, opacity: active ? 1 : 0.75 },
                  ]}
                />
              </View>
              <AppText
                variant="caption"
                color={active ? 'text' : 'textSecondary'}
                weight={active ? 'semibold' : undefined}
                align="center"
                numberOfLines={1}>
                {monthLabel(item.month, true)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {point ? (
        <View style={[styles.detail, { borderColor: theme.border }]}>
          <AppText variant="label" weight="semibold" align="center">
            {monthLabel(point.month, false)}
          </AppText>
          <View style={styles.detailRow}>
            <View style={[styles.legendDot, { backgroundColor: inFill }]} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {inLabel}
            </AppText>
            <AppText variant="label">{formatValue(point.inflow)}</AppText>
          </View>
          <View style={styles.detailRow}>
            <View style={[styles.legendDot, { backgroundColor: outFill }]} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {outLabel}
            </AppText>
            <AppText variant="label">{formatValue(point.outflow)}</AppText>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.legendDot} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {netLabel}
            </AppText>
            <AppText variant="label" weight="semibold" color={point.inflow - point.outflow < 0 ? 'danger' : 'primary'}>
              {formatValue(point.inflow - point.outflow)}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One account's balance at the end of each month (single series, no legend).
 * Tap a month to see its balance; negative months are drawn in the danger colour.
 */
export function BalanceTrend({
  data,
  formatValue,
  monthLabel,
}: {
  data: { month: string; balance: number }[];
  formatValue: (value: number) => string;
  monthLabel: (month: string, short: boolean) => string;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState(data.length - 1);
  const max = Math.max(1, ...data.map((point) => Math.abs(point.balance)));
  const point = data[Math.min(selected, data.length - 1)];

  return (
    <View style={styles.flow}>
      <View style={styles.chart}>
        {data.map((item, index) => {
          const active = index === selected;
          return (
            <Pressable
              key={item.month}
              accessibilityRole="button"
              accessibilityLabel={`${monthLabel(item.month, false)}: ${formatValue(item.balance)}`}
              onPress={() => setSelected(index)}
              style={[styles.column, active && { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.bars, { borderBottomColor: theme.border }]}>
                <View
                  style={[
                    styles.bar,
                    styles.barWide,
                    {
                      height: `${(Math.abs(item.balance) / max) * 100}%`,
                      backgroundColor: item.balance < 0 ? theme.danger : theme.chartIn,
                      opacity: active ? 1 : 0.75,
                    },
                  ]}
                />
              </View>
              <AppText
                variant="caption"
                color={active ? 'text' : 'textSecondary'}
                weight={active ? 'semibold' : undefined}
                align="center"
                numberOfLines={1}>
                {monthLabel(item.month, true)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {point ? (
        <View style={[styles.detail, { borderColor: theme.border }]}>
          <View style={styles.detailRow}>
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {monthLabel(point.month, false)}
            </AppText>
            <AppText variant="label" weight="semibold" color={point.balance < 0 ? 'danger' : 'text'}>
              {formatValue(point.balance)}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barWide: { width: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: 2,
  },
  meter: { gap: Spacing.one, paddingVertical: Spacing.two },
  meterLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2, direction: 'ltr' },
  flow: { gap: Spacing.two },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  // Time runs left to right in every language.
  chart: { flexDirection: 'row', height: 150, gap: 2, direction: 'ltr' },
  column: { flex: 1, height: '100%', gap: Spacing.one, borderRadius: Radius.small, paddingTop: Spacing.one },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  bar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  barNarrow: { width: 7 },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
