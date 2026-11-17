import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { AmountInput, Card, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addPeriods, periodRange, today, type Period } from '@/lib/dates';
import { parseAmount } from '@/lib/format';
import { useAccounts, useBalances, useLedgerLabels } from '@/lib/ledger/hooks';
import type { Account } from '@/lib/ledger/types';
import {
  amountForDeadline,
  createPlanTransfer,
  deleteGoal,
  PLAN_PERIODS,
  planStatus,
} from '@/lib/wallet/saving-plan';
import type { Goal, SavingPlan } from '@/lib/wallet/types';
import { saveGoal, useGoals } from '@/lib/wallet/wallet';

type PlanChoice = 'none' | Period;
type PlanMode = 'amount' | 'deadline';

/** True when money moves between the two accounts without an exchange rate. */
function sameUnit(a: Account, b: Account, mainCurrency: string): boolean {
  if (a.unit.kind !== b.unit.kind) return false;
  if (a.unit.kind !== 'money' || b.unit.kind !== 'money') return true;
  return (a.unit.currency ?? mainCurrency) === (b.unit.currency ?? mainCurrency);
}

/** Last day of the Nth period from today (the current period counts as the first). */
function deadlineIn(count: number | null, every: Period): string | null {
  if (!count || count < 1 || !Number.isInteger(count)) return null;
  return periodRange(addPeriods(today(), every, count - 1), every).end;
}

function GoalCard({ goal, account, saved }: { goal: Goal; account?: Account; saved: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { accountName, amount, format } = useLedgerLabels();
  const ratio = Math.max(0, Math.min(1, goal.target ? saved / goal.target : 0));
  const status = goal.plan ? planStatus(goal, goal.plan, saved) : null;
  const show = (value: number) => (account ? amount(account, value) : format.number(value));

  const confirmDelete = () =>
    Alert.alert(t('common.delete'), t('wallet.deleteGoalConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteGoal(goal) },
    ]);

  return (
    <Pressable onLongPress={confirmDelete}>
      <Card tone={ratio >= 1 ? 'accent' : 'surface'}>
        <AppText variant="heading">{goal.name}</AppText>
        <AppText variant="caption" color="textSecondary">
          {account
            ? `${accountName(account)} · ${t('wallet.goalProgress', { saved: show(saved), target: show(goal.target) })}`
            : ''}
        </AppText>
        <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
          <View
            style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: ratio >= 1 ? theme.accent : theme.primary }]}
          />
        </View>

        {goal.plan && status ? (
          <View style={styles.plan}>
            <AppText variant="label">
              {t('wallet.planEvery', { amount: show(goal.plan.amount), period: t(`wallet.periods.${goal.plan.every}`) })}
              {goal.plan.deadline ? ` · ${t('wallet.planBy', { date: format.day(goal.plan.deadline) })}` : ''}
            </AppText>
            {status.reached ? (
              <AppText variant="caption" color="primary">
                {t('wallet.goalReached')}
              </AppText>
            ) : (
              <>
                <AppText variant="caption" color={status.thisPeriod > 0 ? 'text' : 'primary'}>
                  {status.thisPeriod > 0
                    ? t('wallet.planThisPeriod', { period: t(`task.this.${goal.plan.every}`), amount: show(status.thisPeriod) })
                    : t('wallet.planCovered', { period: t(`task.this.${goal.plan.every}`) })}
                </AppText>
                {status.behind > 0 ? (
                  <AppText variant="caption" color="danger">
                    {t('wallet.planBehind', { amount: show(status.behind) })}
                  </AppText>
                ) : null}
                {status.finish ? (
                  <AppText variant="caption" color="textSecondary">
                    {t('wallet.planFinish', { date: format.day(status.finish) })}
                  </AppText>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** Savings goals: a target, the account that holds the savings, and an optional saving plan. */
export default function GoalsScreen() {
  const { t } = useTranslation();
  const goals = useGoals();
  const accounts = useAccounts();
  const balances = useBalances();
  const { accountName, amount, format, mainCurrency } = useLedgerLabels();
  const savings = accounts.filter(
    (account) => !account.archived && (account.unit.kind === 'money' || account.unit.kind === 'gold') && !account.fixed,
  );
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [accountId, setAccountId] = useState(savings[0]?.id ?? '');
  const [every, setEvery] = useState<PlanChoice>('none');
  const [mode, setMode] = useState<PlanMode>('amount');
  const [planAmount, setPlanAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [fromId, setFromId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const goalAccount = savings.find((account) => account.id === accountId);
  const saved = goalAccount ? (balances.get(goalAccount.id) ?? 0) : 0;
  const sources = goalAccount
    ? accounts.filter(
        (account) =>
          !account.archived &&
          account.id !== goalAccount.id &&
          (account.unit.kind === 'money' || account.unit.kind === 'gold') &&
          account.fixed !== 'sadaqa' &&
          account.fixed !== 'zakat' &&
          sameUnit(account, goalAccount, mainCurrency),
      )
    : [];

  const targetValue = parseAmount(target);
  const deadlineDay = every !== 'none' ? deadlineIn(parseAmount(deadline), every) : null;
  const computed =
    every !== 'none' && mode === 'deadline' && targetValue && deadlineDay
      ? amountForDeadline(targetValue, saved, every, deadlineDay)
      : null;

  const add = async () => {
    setError(null);
    if (!name.trim()) return setError(t('common.nameRequired'));
    if (!targetValue || targetValue <= 0 || !goalAccount) return setError(t('common.invalidAmount'));

    let plan: SavingPlan | undefined;
    if (every !== 'none') {
      if (mode === 'deadline') {
        if (!deadlineDay || !computed) return setError(t('wallet.planBadCount'));
        plan = { every, amount: computed, start: today(), startSaved: saved, deadline: deadlineDay };
      } else {
        const value = parseAmount(planAmount);
        if (!value || value <= 0) return setError(t('common.invalidAmount'));
        plan = { every, amount: value, start: today(), startSaved: saved };
      }
    }

    const goal = await saveGoal({ name: name.trim(), target: targetValue, accountId: goalAccount.id, plan });
    if (plan && fromId && sources.some((account) => account.id === fromId)) {
      const recurringId = await createPlanTransfer(goal, plan, fromId);
      await saveGoal({ ...goal, recurringId });
    }
    setName('');
    setTarget('');
    setPlanAmount('');
    setDeadline('');
    setEvery('none');
    setFromId('');
  };

  return (
    <Screen back title={t('wallet.goals')}>
      {goals.length ? (
        goals.map((goal) => {
          const account = accounts.find((item) => item.id === goal.accountId);
          return (
            <GoalCard key={goal.id} goal={goal} account={account} saved={account ? (balances.get(account.id) ?? 0) : 0} />
          );
        })
      ) : (
        <AppText variant="label" color="textSecondary" align="center">
          {t('wallet.noGoals')}
        </AppText>
      )}

      <Section title={t('wallet.addGoal')}>
        <TextField label={t('wallet.goalName')} value={name} onChangeText={setName} error={error} />
        <AmountInput label={t('wallet.goalTarget')} value={target} onChangeText={setTarget} />
        <AppText variant="label" color="textSecondary">
          {t('wallet.goalAccount')}
        </AppText>
        <Chips
          options={savings.map((account) => ({ value: account.id, label: accountName(account) }))}
          value={accountId}
          onChange={(value) => {
            setAccountId(value);
            setFromId('');
          }}
        />
        {goalAccount ? (
          <AppText variant="caption" color="textSecondary">
            {t('wallet.alreadySaved', { amount: amount(goalAccount, saved) })}
          </AppText>
        ) : null}

        <AppText variant="label" color="textSecondary">
          {t('wallet.plan')}
        </AppText>
        <Chips
          options={[
            { value: 'none' as PlanChoice, label: t('wallet.noPlan') },
            ...PLAN_PERIODS.map((value) => ({ value: value as PlanChoice, label: t(`wallet.planPeriods.${value}`) })),
          ]}
          value={every}
          onChange={setEvery}
        />

        {every !== 'none' ? (
          <>
            <Chips
              options={[
                { value: 'amount' as PlanMode, label: t('wallet.planByAmount') },
                { value: 'deadline' as PlanMode, label: t('wallet.planByDate') },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'amount' ? (
              <AmountInput
                label={t('wallet.planAmount', { period: t(`wallet.periods.${every}`) })}
                value={planAmount}
                onChangeText={setPlanAmount}
              />
            ) : (
              <>
                <AmountInput
                  label={t('wallet.planReachIn')}
                  value={deadline}
                  onChangeText={setDeadline}
                  suffix={t(`wallet.periodUnits.${every}`)}
                />
                {computed !== null && goalAccount ? (
                  <AppText variant="caption" color="primary">
                    {t('wallet.planEvery', { amount: amount(goalAccount, computed), period: t(`wallet.periods.${every}`) })}
                    {deadlineDay ? ` · ${t('wallet.planBy', { date: format.day(deadlineDay) })}` : ''}
                  </AppText>
                ) : null}
              </>
            )}

            {sources.length ? (
              <>
                <AppText variant="label" color="textSecondary">
                  {t('wallet.planTransferFrom')}
                </AppText>
                <Chips
                  options={[
                    { value: '', label: t('wallet.planNoTransfer') },
                    ...sources.map((account) => ({ value: account.id, label: accountName(account) })),
                  ]}
                  value={fromId}
                  onChange={setFromId}
                />
                <AppText variant="caption" color="textSecondary">
                  {t('wallet.planTransferHint')}
                </AppText>
              </>
            ) : null}
          </>
        ) : null}

        <Button title={t('common.add')} variant="secondary" onPress={() => void add()} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: Spacing.one },
  fill: { height: 8, borderRadius: 4 },
  plan: { marginTop: Spacing.two, gap: 2 },
});
