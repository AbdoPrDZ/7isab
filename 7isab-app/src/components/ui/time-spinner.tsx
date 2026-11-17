import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { IconButton } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLedgerLabels } from '@/lib/ledger/hooks';

/** Hours and minutes with − / + buttons; the numbers can also be typed. */
export function TimeSpinner({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const wrap = (value: number, size: number) => ((value % size) + size) % size;

  const part = (value: number, size: number, step: number, set: (value: number) => void, label: string) => (
    <View style={styles.spinPart}>
      <IconButton label={`${label} +`} size={40} onPress={() => set(wrap(value + step, size))}>
        <PlusIcon size={20} color={theme.primary} />
      </IconButton>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        maxLength={2}
        value={format.digits(String(value).padStart(2, '0'))}
        selectTextOnFocus
        onChangeText={(text) => {
          const digits = text.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
          if (digits === '') return;
          set(Math.min(size - 1, Number(digits)));
        }}
        style={[styles.spinValue, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
      />
      <IconButton label={`${label} −`} size={40} onPress={() => set(wrap(value - step, size))}>
        <MinusIcon size={20} color={theme.primary} />
      </IconButton>
    </View>
  );

  return (
    // Hours then minutes, left to right in every language (like a clock).
    <View style={styles.spinner}>
      {part(hour, 24, 1, (value) => onChange(value, minute), 'HH')}
      <AppText variant="title">:</AppText>
      {part(minute, 60, 5, (value) => onChange(hour, value), 'MM')}
    </View>
  );
}

const styles = StyleSheet.create({
  spinner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    direction: 'ltr',
  },
  spinPart: { alignItems: 'center', gap: Spacing.two },
  spinValue: {
    width: 84,
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.one,
  },
});
