/**
 * Shared building blocks for screens: a screen with the patterned header and
 * a scrolling body, cards, list rows, chips and an amount input.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

import { AppText, useFontFamily } from './app-text';
import { ChevronIcon, PlusIcon } from './icons';
import { ScreenHeader } from './screen-header';

type ScreenProps = {
  title: string;
  subtitle?: string;
  /** Show a back button (stack screens). */
  back?: boolean;
  /** Content before the title (e.g. the profile photo on Home). */
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  children: ReactNode;
  /** Extra content pinned below the scroll view (e.g. a save button). */
  footer?: ReactNode;
  /** Tab screens sit above the tab bar, so they don't need the bottom inset. */
  inTabs?: boolean;
  /** Header buttons on their own row, title and subtitle below (Home). */
  stackedHeader?: boolean;
};

export function Screen({
  title,
  subtitle,
  back = false,
  headerStart,
  headerEnd,
  children,
  footer,
  inTabs = false,
  stackedHeader = false,
}: ScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { direction } = useDirection();
  const insets = useSafeAreaInsets();
  const bottom = inTabs ? Spacing.five : insets.bottom + Spacing.five;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, direction }]}>
      <ScreenHeader title={title} subtitle={subtitle} backLabel={back ? t('settings.back') : undefined} start={headerStart} end={headerEnd} stacked={stackedHeader} />
      {/* The keyboard pushes the content and the footer (e.g. Save) up instead of covering them;
          Android draws edge-to-edge, so it needs the padding too. */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: footer ? Spacing.four : bottom }]}>
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: inTabs ? Spacing.three : insets.bottom + Spacing.three, borderColor: theme.border },
            ]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? (
            <AppText variant="label" weight="semibold" color="textSecondary" style={styles.flex}>
              {title}
            </AppText>
          ) : null}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'danger' | 'accent' }) {
  const theme = useTheme();
  const colors = {
    surface: { backgroundColor: theme.surface, borderColor: theme.border },
    danger: { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
    accent: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  }[tone];
  return <View style={[styles.card, colors, style]}>{children}</View>;
}

type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: ThemeColor;
  start?: ReactNode;
  end?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
};

/** A list row inside a card. */
export function Row({ title, subtitle, value, valueColor = 'text', start, end, onPress, chevron }: RowProps) {
  const theme = useTheme();
  const { isRtl } = useDirection();

  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceMuted }]}>
      {start}
      <View style={styles.flex}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="label" weight="semibold" color={valueColor}>
          {value}
        </AppText>
      ) : null}
      {end}
      {chevron ? <ChevronIcon size={18} color={theme.textSecondary} flip={isRtl} /> : null}
    </Pressable>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** Pill button for a section header (e.g. "Add an account"): a plus icon, or no icon for links. */
export function SectionAction({ label, onPress, plus = true }: { label: string; onPress: () => void; plus?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sectionAction,
        { backgroundColor: pressed ? theme.border : theme.primarySoft, borderColor: theme.primary },
      ]}>
      {plus ? <PlusIcon size={16} color={theme.primary} /> : null}
      <AppText variant="caption" weight="semibold" color="primary">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Last row of a list card that adds a new item: a plus in a circle and the label in the primary colour. */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.addCircle, { backgroundColor: theme.primary }]}>
        <PlusIcon size={18} color={theme.textOnPrimary} />
      </View>
      <AppText variant="label" weight="semibold" color="primary" style={styles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

type ChipsProps<T extends string | number> = {
  options: readonly { value: T; label: string }[];
  value: T | T[];
  onChange: (value: T) => void;
};

/** Wrapping pill buttons; pass an array value for multi-select. */
export function Chips<T extends string | number>({ options, value, onChange }: ChipsProps<T>) {
  const theme = useTheme();
  const selected = (option: T) => (Array.isArray(value) ? value.includes(option) : value === option);

  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = selected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.primary : theme.surface,
                borderColor: active ? theme.primary : theme.border,
              },
            ]}>
            <AppText variant="label" color={active ? 'textOnPrimary' : 'text'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type AmountInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suffix?: string;
  error?: string | null;
  placeholder?: string;
};

/** Numeric input; amounts are always written left-to-right. */
export function AmountInput({ label, value, onChangeText, suffix, error, placeholder = '0' }: AmountInputProps) {
  const theme = useTheme();
  const fontFamily = useFontFamily('semibold');

  return (
    <View style={styles.amount}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <View style={[styles.amountRow, { borderColor: error ? theme.danger : theme.border, backgroundColor: theme.surface }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.amountInput, { color: theme.text, fontFamily }]}
        />
        {suffix ? (
          <AppText variant="label" color="textSecondary">
            {suffix}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** Small round icon button. */
export function IconButton({
  onPress,
  label,
  children,
  tone = 'soft',
  size = 40,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
  tone?: 'soft' | 'solid' | 'onHero';
  size?: number;
}) {
  const theme = useTheme();
  const background = { soft: theme.primarySoft, solid: theme.primary, onHero: 'rgba(255,255,255,0.14)' }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: pressed ? 0.7 : 1 },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.five,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  addCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.small,
    minHeight: 48,
  },
  divider: { height: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  amount: { gap: Spacing.one + Spacing.half },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    direction: 'ltr',
  },
  amountInput: { flex: 1, minHeight: 52, fontSize: 20, textAlign: 'left' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
});
