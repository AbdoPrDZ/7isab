/**
 * Islamic decorations, used sparingly: a mihrab-arch card for main cards and
 * a thin gold divider with a small star in the middle.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ARCH_HEIGHT = 26;

/**
 * Card whose top edge is a pointed mihrab arch, drawn in gold. Use only on the
 * main card of a screen.
 */
export function ArchCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const mid = width / 2;
  // Pointed arch: two curves meeting at the top centre, over the full width.
  const arch = width
    ? `M0 ${ARCH_HEIGHT} C ${width * 0.18} ${ARCH_HEIGHT} ${mid - 22} ${ARCH_HEIGHT * 0.55} ${mid} 1 C ${mid + 22} ${ARCH_HEIGHT * 0.55} ${width * 0.82} ${ARCH_HEIGHT} ${width} ${ARCH_HEIGHT}`
    : '';

  return (
    <View style={style} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width ? (
        <Svg width={width} height={ARCH_HEIGHT + 2} style={styles.arch}>
          <Path d={`${arch} Z`} fill={theme.accentSoft} />
          <Path d={arch} fill="none" stroke={theme.accent} strokeWidth={1.5} />
        </Svg>
      ) : null}
      <View style={[styles.body, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>{children}</View>
    </View>
  );
}

/** Thin gold line with a small eight-point star in the middle. */
export function GoldDivider() {
  const theme = useTheme();

  return (
    <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.line, { backgroundColor: theme.accent }]} />
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path
          d="M12 2l2.6 4.3 4.5-1.4-1.4 4.5L22 12l-4.3 2.6 1.4 4.5-4.5-1.4L12 22l-2.6-4.3-4.5 1.4 1.4-4.5L2 12l4.3-2.6-1.4-4.5 4.5 1.4z"
          fill={theme.accent}
        />
      </Svg>
      <View style={[styles.line, { backgroundColor: theme.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  arch: { marginBottom: -1.5 },
  body: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.large,
    borderBottomRightRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.one,
    gap: Spacing.one,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, opacity: 0.8 },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
