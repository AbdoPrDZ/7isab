import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { ArchCard, GoldDivider } from '@/components/ui/decor';
import { Button } from '@/components/ui/button';
import { AlertIcon, BackIcon } from '@/components/ui/icons';
import { Card, Divider, Row, Screen, Section, SectionAction } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, monthOf, today } from '@/lib/dates';
import { useAccounts, useBalances, useEntries, useLedgerLabels, useSinTypes, useTasks } from '@/lib/ledger/hooks';
import { computeBalances, deleteEntry, fixedAccountId, round } from '@/lib/ledger/ledger';
import type { Entry, FixedAccountKey } from '@/lib/ledger/types';

const AKHIRA_KINDS: Entry['kind'][] = ['task_done', 'task_missed', 'prayer_missed', 'prayer_late', 'sin', 'fast_tap', 'thanb_paid', 'sadaqa', 'zakat', 'top_up'];

function lineAmount(entry: Entry, account: string): number {
  return entry.lines.filter((line) => line.account === account).reduce((sum, line) => sum + line.amount, 0);
}

/** Monthly totals for the report. */
function monthReport(entries: Entry[], month: string) {
  const ids = Object.fromEntries(
    (['akhira', 'thanb', 'sadaqa', 'zakat'] as FixedAccountKey[]).map((key) => [key, fixedAccountId(key)]),
  ) as Record<'akhira' | 'thanb' | 'sadaqa' | 'zakat', string>;
  const inMonth = entries.filter((entry) => monthOf(entry.date) === month);
  const before = `${month}-00`;
  const carryOver = computeBalances(entries.filter((entry) => entry.date < before)).get(ids.thanb) ?? 0;

  let earned = 0;
  let lost = 0;
  let thanbAdded = 0;
  let thanbPaid = 0;
  let sadaqa = 0;
  let zakat = 0;
  for (const entry of inMonth) {
    const akhira = lineAmount(entry, ids.akhira);
    if (akhira > 0) earned += akhira;
    else lost -= akhira;
    const thanb = lineAmount(entry, ids.thanb);
    if (thanb > 0) thanbAdded += thanb;
    else thanbPaid -= thanb;
    if (entry.kind === 'sadaqa' || entry.kind === 'thanb_paid') sadaqa -= lineAmount(entry, ids.sadaqa);
    if (entry.kind === 'zakat') zakat -= lineAmount(entry, ids.zakat);
  }
  return {
    inMonth: inMonth.filter((entry) => AKHIRA_KINDS.includes(entry.kind) || entry.lines.some((l) => l.account === ids.akhira)),
    carryOver: round(carryOver),
    earned: round(earned),
    lost: round(lost),
    thanbAdded: round(thanbAdded),
    thanbPaid: round(thanbPaid),
    sadaqa: round(sadaqa),
    zakat: round(zakat),
  };
}

export default function HisabScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isRtl } = useDirection();
  const accounts = useAccounts();
  const balances = useBalances();
  const entries = useEntries();
  const tasks = useTasks();
  const sinTypes = useSinTypes();
  const { accountName, amount, format, sinName, mainCurrency } = useLedgerLabels();
  const [month, setMonth] = useState(monthOf(today()));
  const report = useMemo(() => monthReport(entries, month), [entries, month]);

  const fixed = accounts.filter((account) => account.fixed && account.fixed !== 'cash');
  const negatives = fixed.filter(
    (account) => (account.fixed === 'sadaqa' || account.fixed === 'zakat') && (balances.get(account.id) ?? 0) < 0,
  );
  const thanbBalance = balances.get(fixed.find((a) => a.fixed === 'thanb')?.id ?? '') ?? 0;

  const describe = (entry: Entry) => {
    if (entry.taskId) return tasks.find((task) => task.id === entry.taskId)?.title ?? t(`hisab.kinds.${entry.kind}`);
    if (entry.sinTypeId) {
      const sin = sinTypes.find((item) => item.id === entry.sinTypeId);
      return sin ? sinName(sin) : t(`hisab.kinds.${entry.kind}`);
    }
    return entry.note || t(`hisab.kinds.${entry.kind}`);
  };

  const entryValue = (entry: Entry) => {
    const akhira = lineAmount(entry, fixedAccountId('akhira'));
    if (akhira) return { text: `${akhira > 0 ? '+' : ''}${format.points(akhira)}`, positive: akhira > 0 };
    const line = entry.lines[0];
    return { text: line ? format.money(line.amount, mainCurrency) : '', positive: (line?.amount ?? 0) > 0 };
  };

  const confirmDelete = (entry: Entry) =>
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteEntry(entry.id) },
    ]);

  const action = (kind: string) => router.push({ pathname: '/hisab/action', params: { kind } });

  return (
    <Screen inTabs title={t('hisab.title')} subtitle={t('hisab.subtitle')}>
      {negatives.map((account) => (
        <Card key={account.id} tone="danger" style={styles.warning}>
          <AlertIcon size={20} color={theme.danger} />
          <AppText variant="label" color="danger" style={styles.flex}>
            {t('hisab.negative', { account: accountName(account) })}
          </AppText>
        </Card>
      ))}

      <ArchCard>
        {fixed.map((account, index) => {
          const value = balances.get(account.id) ?? 0;
          return (
            <Fragment key={account.id}>
              {index > 0 ? <Divider /> : null}
              <Row
                title={accountName(account)}
                value={amount(account, value)}
                valueColor={value < 0 && account.fixed !== 'thanb' ? 'danger' : account.fixed === 'akhira' ? 'primary' : 'text'}
              />
            </Fragment>
          );
        })}
      </ArchCard>

      <Section title={t('hisab.actions')}>
        {thanbBalance > 0 ? (
          <AppText variant="caption" color="textSecondary">
            {t('hisab.thanbDue', { points: format.points(thanbBalance) })}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button title={t('hisab.payThanb')} style={styles.action} onPress={() => action('thanb')} />
          <Button title={t('hisab.giveSadaqa')} style={styles.action} variant="secondary" onPress={() => action('sadaqa')} />
          <Button title={t('hisab.payZakat')} style={styles.action} variant="secondary" onPress={() => action('zakat')} />
          <Button title={t('hisab.topUp')} style={styles.action} variant="secondary" onPress={() => action('topUp')} />
        </View>
        <Button title={t('settingsExtra.sins')} variant="ghost" onPress={() => router.push('/sins')} />
      </Section>

      <GoldDivider />

      <Section
        title={t('hisab.report')}
        action={
          <SectionAction
            label={t('stats.title')}
            plus={false}
            onPress={() => router.push({ pathname: '/stats', params: { tab: 'akhira' } })}
          />
        }>
        <View style={styles.monthRow}>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setMonth(addMonths(month, -1))}>
            <BackIcon size={22} color={theme.primary} flip={isRtl} />
          </Pressable>
          <AppText variant="heading" align="center" style={styles.flex}>
            {format.month(month)}
          </AppText>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            disabled={month >= monthOf(today())}
            onPress={() => setMonth(addMonths(month, 1))}
            style={{ opacity: month >= monthOf(today()) ? 0.3 : 1 }}>
            <BackIcon size={22} color={theme.primary} flip={!isRtl} />
          </Pressable>
        </View>
        <Card>
          <Row title={t('hisab.carryOver')} value={`${format.points(report.carryOver)} ${t('units.thanb')}`} />
          <Divider />
          <Row title={t('hisab.earned')} value={`+${format.points(report.earned)}`} valueColor="primary" />
          <Row title={t('hisab.lost')} value={`−${format.points(report.lost)}`} valueColor="danger" />
          <Divider />
          <Row title={t('hisab.thanbAdded')} value={format.points(report.thanbAdded)} />
          <Row title={t('hisab.thanbPaid')} value={format.points(report.thanbPaid)} />
          <Divider />
          <Row title={t('hisab.sadaqaGiven')} value={format.money(report.sadaqa, mainCurrency)} />
          <Row title={t('hisab.zakatPaid')} value={format.money(report.zakat, mainCurrency)} />
        </Card>
      </Section>

      <Section title={t('hisab.entries')}>
        <Card>
          {report.inMonth.length ? (
            report.inMonth.map((entry, index) => {
              const value = entryValue(entry);
              return (
                <Fragment key={entry.id}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable onLongPress={() => confirmDelete(entry)}>
                    <Row
                      title={describe(entry)}
                      subtitle={`${format.day(entry.date)} · ${t(`hisab.kinds.${entry.kind}`)}`}
                      value={value.text}
                      valueColor={value.positive ? 'primary' : 'danger'}
                    />
                  </Pressable>
                </Fragment>
              );
            })
          ) : (
            <AppText variant="label" color="textSecondary" align="center">
              {t('hisab.noEntries')}
            </AppText>
          )}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: '45%' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.two },
});
