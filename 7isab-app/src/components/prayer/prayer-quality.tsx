/**
 * Khushoo level and place (mosque / home, with a reason at home) of a prayer,
 * as asked in the prayer sheet. What is asked follows Settings → Prayer:
 * askKhushoo, askPlace. At home a reason is required; it says whether it adds a
 * Thanb (or every home prayer does, with "always Thanb"); Jumu'ah at home
 * always adds one.
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Chips } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReasonName, useReasons } from '@/lib/ledger/reasons';
import type { Khushoo, PrayerName, PrayerPlace } from '@/lib/ledger/types';
import { isJumuah, usePrayerSettings } from '@/lib/prayer/prayer';
import type { PrayerQuality } from '@/lib/prayer/tasks';

export const KHUSHOO_LEVELS: Khushoo[] = ['good', 'normal', 'weak'];

/** At home, a reason must be picked. */
export function qualityComplete(quality: PrayerQuality): boolean {
  return quality.place !== 'home' || !!quality.placeReasonId;
}

export function KhushooPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Khushoo | undefined;
  onChange: (value: Khushoo) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <AppText variant="label" weight="semibold">
        {label}
      </AppText>
      <Chips
        options={KHUSHOO_LEVELS.map((level) => ({ value: level, label: t(`prayer.khushoo.${level}`) }))}
        value={value ?? []}
        onChange={onChange}
      />
      {value === 'weak' ? (
        <AppText variant="caption" color="textSecondary">
          {t('prayer.khushoo.weakHint')}
        </AppText>
      ) : null}
    </>
  );
}

/** Place and, at home, the reason. `prayer` / `day` tell whether it is Jumu'ah. */
export function PlacePicker({
  prayer,
  day,
  place,
  reasonId,
  onChange,
}: {
  prayer: PrayerName;
  day: string;
  place: PrayerPlace | undefined;
  reasonId: string | undefined;
  onChange: (place: PrayerPlace, reasonId: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = usePrayerSettings();
  const reasons = useReasons('homePrayer');
  const reasonName = useReasonName();
  const jumuah = isJumuah(prayer, day);
  const reason = reasons.find((item) => item.id === reasonId);
  const thanb = place === 'home' && (jumuah || settings.homeAlwaysThanb || (reason?.thanb ?? false));

  return (
    <>
      <AppText variant="label" weight="semibold">
        {t('prayer.place.question')}
      </AppText>
      <Chips
        options={(['mosque', 'home'] as const).map((value) => ({ value, label: t(`prayer.place.${value}`) }))}
        value={place ?? []}
        onChange={(value) => onChange(value, value === 'home' ? reasonId : undefined)}
      />
      {place === 'home' ? (
        <>
          <AppText variant="label" weight="semibold">
            {t('prayer.place.reason')}
          </AppText>
          <Chips
            options={reasons.map((item) => ({ value: item.id, label: reasonName(item) }))}
            value={reasonId ?? []}
            onChange={(value) => onChange('home', value)}
          />
          {jumuah || reason || settings.homeAlwaysThanb ? (
            <View
              style={[
                styles.note,
                {
                  backgroundColor: thanb ? theme.prayerLateSoft : theme.primarySoft,
                  borderColor: thanb ? theme.prayerLate : theme.primary,
                },
              ]}>
              <AppText variant="caption" color={thanb ? 'text' : 'primary'}>
                {jumuah
                  ? t('prayer.place.jumuahThanb')
                  : thanb
                    ? t('prayer.place.thanb')
                    : t('prayer.place.excused')}
              </AppText>
            </View>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: Radius.medium, borderWidth: 1, padding: Spacing.two },
});
