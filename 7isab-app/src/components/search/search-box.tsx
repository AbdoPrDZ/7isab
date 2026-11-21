import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useFontFamily } from '@/components/ui/app-text';
import { PlusIcon, SearchIcon } from '@/components/ui/icons';
import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

/** A search input with a clear button. */
export function SearchBox({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const fontFamily = useFontFamily('regular');
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.row, { borderColor: focused ? theme.primary : theme.border, backgroundColor: theme.surface }]}>
      <SearchIcon size={20} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('search.placeholder')}
        placeholderTextColor={theme.textSecondary}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={placeholder ?? t('search.placeholder')}
        style={[
          styles.input,
          { color: theme.text, fontFamily, textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
        ]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={10} onPress={() => onChangeText('')}>
          <View style={styles.clear}>
            <PlusIcon size={18} color={theme.textSecondary} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  input: { flex: 1, minHeight: 48, fontSize: 16, paddingVertical: Spacing.two },
  clear: { transform: [{ rotate: '45deg' }] },
});
