import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

import { AppText, useFontFamily } from './app-text';
import { EyeIcon, EyeOffIcon } from './icons';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  /** Adds a show/hide toggle; pass its two labels. */
  secureToggle?: { show: string; hide: string };
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, error, secureToggle, secureTextEntry, style, onFocus, onBlur, ref, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const fontFamily = useFontFamily('regular');
  const { isRtl } = useDirection();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  const borderColor = error ? theme.danger : focused ? theme.primary : theme.border;

  return (
    <View style={styles.container}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <View style={[styles.inputRow, { borderColor, backgroundColor: theme.surface }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={hidden}
          style={[
            styles.input,
            { color: theme.text, fontFamily, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
            style,
          ]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {secureToggle && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? secureToggle.show : secureToggle.hide}
            hitSlop={8}
            onPress={() => setHidden((value) => !value)}
            style={styles.toggle}>
            {hidden ? <EyeIcon size={22} color={theme.textSecondary} /> : <EyeOffIcon size={22} color={theme.primary} />}
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one + Spacing.half,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 16,
    paddingVertical: Spacing.three,
  },
  toggle: {
    paddingStart: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
