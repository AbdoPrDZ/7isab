import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { HalalRules } from '@/components/investments/halal-rules';
import { useInvestmentMoney } from '@/components/investments/use-investment-money';
import { StatGrid, StatTile } from '@/components/stats/charts';
import { AppText } from '@/components/ui/app-text';
import { Card, Divider, Row, Screen, Section, SectionAction } from '@/components/ui/layout';
import { useInvestmentEntries, useInvestments, type Investment } from '@/lib/investments/investments';
import { investmentStats, type InvestmentStats } from '@/lib/investments/stats';

/** Every investment with overall figures (in the main currency) and the halal rules. */
export default function InvestmentsScreen() {
  const { t } = useTranslation();
  const investments = useInvestments();
  const entries = useInvestmentEntries();
  const { money, mainMoney, percent, toMain } = useInvestmentMoney();
  const [showClosed, setShowClosed] = useState(false);

  const stats = useMemo(
    () => new Map(investments.map((investment) => [investment.id, investmentStats(investment, entries.get(investment.id) ?? [])])),
    [investments, entries],
  );
  const active = investments.filter((investment) => !investment.closedAt);
  const closed = investments.filter((investment) => investment.closedAt);

  const totals = useMemo(() => {
    let capital = 0;
    let added = 0;
    let net = 0;
    let expected = 0;
    let withEstimate = 0;
    for (const investment of investments) {
      const figures = stats.get(investment.id)!;
      if (!investment.closedAt) capital += toMain(investment, figures.capitalNow);
      added += toMain(investment, figures.capitalIn);
      net += toMain(investment, figures.net);
      if (figures.expectedToDate !== null) {
        expected += toMain(investment, figures.expectedToDate);
        withEstimate += toMain(investment, figures.net);
      }
    }
    return { capital, net, roi: added > 0 ? net / added : null, achieved: expected > 0 ? withEstimate / expected : null };
  }, [investments, stats, toMain]);

  const open = (id: string) => router.push({ pathname: '/investment/[id]', params: { id } });

  const list = (items: Investment[]) => (
    <Card>
      {items.map((investment, index) => {
        const figures = stats.get(investment.id) as InvestmentStats;
        return (
          <Fragment key={investment.id}>
            {index > 0 ? <Divider /> : null}
            <Row
              title={investment.name}
              subtitle={[
                t(`investments.kinds.${investment.kind}`),
                t('investments.capitalShort', { value: money(investment, figures.capitalNow) }),
                figures.achieved !== null ? t('investments.achievedShort', { value: percent(figures.achieved) }) : null,
                figures.overdue ? t('investments.overdueShort') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              value={money(investment, figures.net)}
              valueColor={figures.net < 0 ? 'danger' : figures.net > 0 ? 'primary' : 'text'}
              chevron
              onPress={() => open(investment.id)}
            />
          </Fragment>
        );
      })}
    </Card>
  );

  return (
    <Screen back title={t('investments.title')} subtitle={t('investments.subtitle')}>
      {investments.length ? (
        <StatGrid>
          <StatTile label={t('investments.totalCapital')} value={mainMoney(totals.capital)} />
          <StatTile
            label={t('investments.totalNet')}
            value={mainMoney(totals.net)}
            valueColor={totals.net < 0 ? 'danger' : 'primary'}
          />
          <StatTile label={t('investments.roi')} value={percent(totals.roi)} />
          <StatTile label={t('investments.achieved')} value={percent(totals.achieved)} />
        </StatGrid>
      ) : null}

      <Section
        title={t('investments.active')}
        action={<SectionAction label={t('investments.add')} onPress={() => router.push('/investment/form')} />}>
        {active.length ? (
          list(active)
        ) : (
          <Card>
            <AppText variant="label" color="textSecondary" align="center">
              {t('investments.empty')}
            </AppText>
          </Card>
        )}
      </Section>

      {closed.length ? (
        <Section
          title={t('investments.closed', { n: closed.length })}
          action={
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowClosed(!showClosed)}>
              <AppText variant="label" color="primary">
                {showClosed ? t('search.showLess') : t('search.showAll')}
              </AppText>
            </Pressable>
          }>
          {showClosed ? list(closed) : null}
        </Section>
      ) : null}

      <HalalRules />
    </Screen>
  );
}
