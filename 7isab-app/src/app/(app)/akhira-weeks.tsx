import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Card, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import { updateSettings } from '@/lib/ledger/ledger';
import { useAkhiraWeeks, useWeeklyAkhiraEnabled, type AkhiraWeek } from '@/lib/ledger/weekly';

/** Weekly Akhira points: the on/off setting, this week and the history of past weeks. */
export default function AkhiraWeeksScreen() {
  const { t } = useTranslation();
  const enabled = useWeeklyAkhiraEnabled();
  const weeks = useAkhiraWeeks();
  const [current, ...past] = weeks;

  return (
    <Screen back title={t('weekly.title')} subtitle={t('weekly.subtitle')}>
      <Card>
        <SwitchRow
          label={t('weekly.enable')}
          hint={t('weekly.enableHint')}
          value={enabled}
          onChange={(on) => void updateSettings({ weeklyAkhira: on })}
        />
      </Card>

      {current ? (
        <Section title={t('weekly.thisWeek')}>
          <WeekCard week={current} current />
        </Section>
      ) : null}

      <Section title={t('weekly.history')}>
        {past.length ? (
          past.map((week) => <WeekCard key={week.start} week={week} />)
        ) : (
          <Card>
            <AppText variant="label" color="textSecondary" align="center">
              {t('weekly.empty')}
            </AppText>
          </Card>
        )}
      </Section>
    </Screen>
  );
}

function WeekCard({ week, current = false }: { week: AkhiraWeek; current?: boolean }) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const points = (value: number) => `${format.points(value)} ${t('units.akhira')}`;
  const thanb = (value: number) => `${format.points(value)} ${t('units.thanb')}`;

  return (
    <Card tone={current ? 'accent' : 'surface'}>
      <Row
        title={t('weekly.range', { from: format.day(week.start), to: format.day(week.end) })}
        subtitle={t('weekly.real', { value: points(week.real) })}
        value={points(week.points)}
        valueColor={week.points < 0 ? 'danger' : 'text'}
      />
      <Divider />
      <View>
        {week.carriedIn ? (
          <Row title={t('weekly.carriedIn')} value={thanb(week.carriedIn)} valueColor="danger" />
        ) : null}
        <Row title={t('weekly.earned')} value={points(week.earned)} />
        <Row title={t('weekly.lost')} value={points(week.lost)} />
        <Row title={t('weekly.thanbAdded')} value={thanb(week.thanbAdded)} />
        <Row title={t('weekly.thanbPaid')} value={thanb(week.thanbPaid)} />
        <Row
          title={t(current ? 'weekly.unpaidNow' : 'weekly.carriedOut')}
          value={thanb(week.carriedOut)}
          valueColor={week.carriedOut ? 'danger' : 'text'}
        />
      </View>
    </Card>
  );
}
