/**
 * Saving plans for goals: put a fixed amount aside every week / month / year,
 * either chosen directly or worked out from a day to reach the target by.
 *
 * Progress is read from the goal account's balance, so any way the money gets
 * there (a transfer, income, the plan's repeating transfer) counts.
 */
import { addPeriods, periodRange, periodsCount, today, type Period } from '@/lib/dates';
import { removeDoc } from '@/lib/data/vault';
import { round } from '@/lib/ledger/ledger';
import { RecordTypes } from '@/lib/ledger/types';

import { saveRecurring } from './recurring';
import type { Goal, Recurring, SavingPlan } from './types';

export const PLAN_PERIODS: Period[] = ['week', 'month', 'year'];

export const PERIOD_FREQUENCY: Record<Period, Recurring['frequency']> = {
  week: 'weekly',
  month: 'monthly',
  year: 'yearly',
};

/** Rounds up to 2 decimals, so the plan never falls short of the target. */
function roundUp(value: number): number {
  return Math.ceil(value * 100 - 1e-9) / 100;
}

/** Amount per period to go from `saved` to `target` by `deadline` (null when the day has passed). */
export function amountForDeadline(
  target: number,
  saved: number,
  every: Period,
  deadline: string,
  day: string = today(),
): number | null {
  const periods = periodsCount(day, deadline, every);
  if (periods <= 0) return null;
  return roundUp(Math.max(0, target - saved) / periods);
}

export type PlanStatus = {
  /** Still to put aside in the current period (0 when this period is covered). */
  thisPeriod: number;
  /** Shortfall from the periods already over. */
  behind: number;
  /** Last day of the period the target is expected to be reached in (null when reached). */
  finish: string | null;
  reached: boolean;
};

export function planStatus(goal: Goal, plan: SavingPlan, saved: number, day: string = today()): PlanStatus {
  const remaining = Math.max(0, goal.target - saved);
  if (remaining <= 0) return { thisPeriod: 0, behind: 0, finish: null, reached: true };

  // Periods started so far, counting the current one.
  const started = periodsCount(plan.start, day, plan.every);
  const expectedNow = Math.min(goal.target, plan.startSaved + started * plan.amount);
  const expectedBefore = Math.min(goal.target, plan.startSaved + Math.max(0, started - 1) * plan.amount);
  const behind = round(Math.max(0, expectedBefore - saved));
  const thisPeriod = round(Math.max(0, expectedNow - Math.max(saved, expectedBefore)));

  const periodsLeft = plan.amount > 0 ? Math.ceil(remaining / plan.amount - 1e-9) : 0;
  const finish = periodsLeft > 0 ? periodRange(addPeriods(day, plan.every, periodsLeft - 1), plan.every).end : null;

  return { thisPeriod, behind, finish, reached: false };
}

/** Creates the repeating transfer that moves the plan amount into the goal account (asks to confirm each time). */
export async function createPlanTransfer(goal: Goal, plan: SavingPlan, fromAccountId: string): Promise<string> {
  const item = await saveRecurring({
    name: goal.name,
    kind: 'transfer',
    accountId: fromAccountId,
    toAccountId: goal.accountId,
    amount: plan.amount,
    frequency: PERIOD_FREQUENCY[plan.every],
    next: today(),
    auto: false,
  });
  return item.id;
}

/** Deletes a goal and its repeating transfer (money already moved stays). */
export async function deleteGoal(goal: Goal): Promise<void> {
  if (goal.recurringId) await removeDoc(RecordTypes.recurring, goal.recurringId);
  await removeDoc(RecordTypes.goal, goal.id);
}
