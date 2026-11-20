import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Card, Chips, Divider, Screen, Section } from '@/components/ui/layout';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { REPORT_PERIODS, updateReportSettings, useReportSettings } from '@/lib/reports/reports';

const GOOD_AT = [70, 75, 80, 85, 90];
const NORMAL_AT = [30, 40, 50, 60];

/** Report notifications (time, which periods) and the rating thresholds. */
export default function ReportSettingsScreen() {
  const { t } = useTranslation();
  const settings = useReportSettings();
  const { format } = useLedgerLabels();
  const percent = (value: number) => format.digits(`${value}%`);

  return (
    <Screen back title={t('report.settings')} subtitle={t('report.settingsHint')}>
      <Section title={t('report.notifyTime')}>
        <TimeSpinner
          hour={settings.hour}
          minute={settings.minute}
          onChange={(hour, minute) => void updateReportSettings({ hour, minute })}
        />
      </Section>

      <Section title={t('report.notifyWhich')}>
        <Card>
          {REPORT_PERIODS.map((period, index) => (
            <View key={period}>
              {index > 0 ? <Divider /> : null}
              <SwitchRow
                label={t(`report.notifyLabels.${period}`)}
                value={settings.notify[period]}
                onChange={(on) => void updateReportSettings({ notify: { ...settings.notify, [period]: on } })}
              />
            </View>
          ))}
        </Card>
      </Section>

      <Section title={t('report.thresholds')}>
        <AppText variant="label" color="textSecondary">
          {t('report.goodAt', { rating: t('report.ratings.good') })}
        </AppText>
        <Chips
          options={GOOD_AT.map((value) => ({ value, label: percent(value) }))}
          value={settings.goodAt}
          onChange={(goodAt) => void updateReportSettings({ goodAt, normalAt: Math.min(settings.normalAt, goodAt - 10) })}
        />
        <AppText variant="label" color="textSecondary">
          {t('report.normalAt', { rating: t('report.ratings.normal') })}
        </AppText>
        <Chips
          options={NORMAL_AT.filter((value) => value < settings.goodAt).map((value) => ({ value, label: percent(value) }))}
          value={settings.normalAt}
          onChange={(normalAt) => void updateReportSettings({ normalAt })}
        />
        <AppText variant="caption" color="textSecondary">
          {t('report.thresholdsHint')}
        </AppText>
      </Section>
    </Screen>
  );
}
