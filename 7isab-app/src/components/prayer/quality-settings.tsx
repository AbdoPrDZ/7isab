/**
 * Settings → Prayer → quality: ask the khushoo level, ask the place, "praying
 * at home always gives a Thanb", and the editable reasons for praying at home
 * (each one excused or a Thanb). Penalties come from the sin types
 * (Weak khushoo, Prayer at home, Missed Jumu'ah) on the Sins screen.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { ReasonsEditor } from '@/components/reasons-editor';
import { AppText } from '@/components/ui/app-text';
import { Card, Divider, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updatePrayerSettings, usePrayerSettings, type PrayerSettings } from '@/lib/prayer/prayer';

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="textSecondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.primary }} />
    </View>
  );
}

export function PrayerQualitySettings() {
  const { t } = useTranslation();
  const settings = usePrayerSettings();

  const change = (changes: Partial<Pick<PrayerSettings, 'askKhushoo' | 'askPlace' | 'homeAlwaysThanb'>>) =>
    void updatePrayerSettings(changes);

  return (
    <Section title={t('prayer.quality.title')}>
      <Card>
        <SwitchRow
          label={t('prayer.quality.askKhushoo')}
          hint={t('prayer.quality.askKhushooHint')}
          value={settings.askKhushoo}
          onChange={(askKhushoo) => change({ askKhushoo })}
        />
        <Divider />
        <SwitchRow
          label={t('prayer.quality.askPlace')}
          hint={t('prayer.quality.askPlaceHint')}
          value={settings.askPlace}
          onChange={(askPlace) => change({ askPlace })}
        />
        {settings.askPlace ? (
          <>
            <Divider />
            <SwitchRow
              label={t('prayer.quality.homeAlwaysThanb')}
              hint={t('prayer.quality.homeAlwaysThanbHint')}
              value={settings.homeAlwaysThanb}
              onChange={(homeAlwaysThanb) => change({ homeAlwaysThanb })}
            />
          </>
        ) : null}
      </Card>

      {settings.askPlace ? (
        <>
          <AppText variant="label" weight="semibold">
            {t('prayer.quality.reasons')}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {settings.homeAlwaysThanb ? t('prayer.quality.reasonsAlwaysHint') : t('prayer.quality.reasonsHint')}
          </AppText>
          <ReasonsEditor scope="homePrayer" thanbLocked={settings.homeAlwaysThanb} />
          <AppText variant="caption" color="textSecondary">
            {t('prayer.quality.penaltiesHint')}
          </AppText>
        </>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
});
