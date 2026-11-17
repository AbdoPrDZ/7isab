import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const background = { primary: theme.primary, secondary: theme.primarySoft, ghost: 'transparent' }[variant];
  const pressedBackground = { primary: theme.primaryPressed, secondary: theme.border, ghost: theme.primarySoft }[variant];
  const textColor = variant === 'primary' ? 'textOnPrimary' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        { backgroundColor: state.pressed ? pressedBackground : background, opacity: isDisabled ? 0.6 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading && <ActivityIndicator color={variant === 'primary' ? theme.textOnPrimary : theme.primary} />}
        <AppText variant="label" weight="semibold" color={textColor}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.five,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
