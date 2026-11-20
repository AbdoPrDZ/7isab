import { useTranslation } from 'react-i18next';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { ReasonsEditor } from '@/components/reasons-editor';
import { AppText } from '@/components/ui/app-text';
import { Card, Chips, Screen, Section } from '@/components/ui/layout';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { updateBedtimeSettings, useBedtimeSettings } from '@/lib/bedtime/bedtime';
import { useLedgerLabels } from '@/lib/ledger/hooks';

/** Minutes after bedtime still counted as on time. */
const GRACE = [0, 15, 30, 45, 60];

/** Bedtime on / off, the time and grace, and the reasons for sleeping late. */
export default function BedtimeSettingsScreen() {
  const { t } = useTranslation();
  const settings = useBedtimeSettings();
  const { format } = useLedgerLabels();

  return (
    <Screen back title={t('bedtime.settings')} subtitle={t('bedtime.settingsHint')}>
      <Card>
        <SwitchRow
          label={t('bedtime.enabled')}
          hint={t('bedtime.enabledHint')}
          value={settings.enabled}
          onChange={(enabled) => void updateBedtimeSettings({ enabled })}
        />
      </Card>

      {settings.enabled ? (
        <>
          <Section title={t('bedtime.time')}>
            <TimeSpinner
              hour={settings.hour}
              minute={settings.minute}
              onChange={(hour, minute) => void updateBedtimeSettings({ hour, minute })}
            />
          </Section>

          <Section title={t('bedtime.grace')}>
            <Chips
              options={GRACE.map((value) => ({
                value,
                label: value ? t('bedtime.graceMinutes', { minutes: format.number(value) }) : t('bedtime.graceNone'),
              }))}
              value={settings.grace}
              onChange={(grace) => void updateBedtimeSettings({ grace })}
            />
            <AppText variant="caption" color="textSecondary">
              {t('bedtime.graceHint')}
            </AppText>
          </Section>

          <Section title={t('bedtime.reasons')}>
            <AppText variant="caption" color="textSecondary">
              {t('bedtime.reasonsHint')}
            </AppText>
            <ReasonsEditor scope="bedtime" />
            <AppText variant="caption" color="textSecondary">
              {t('bedtime.penaltiesHint')}
            </AppText>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
