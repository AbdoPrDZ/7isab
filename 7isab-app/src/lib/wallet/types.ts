import type { Doc } from '@/lib/data/vault';
import type { Period } from '@/lib/dates';

export type Category = Doc & {
  name: string;
  /** Translation key for built-in categories. */
  preset?: string;
  kind: 'expense' | 'income';
  parentId?: string;
  color: string;
  order: number;
};

/** Monthly budget for a category, in the main currency. */
export type Budget = Doc & { categoryId: string; amount: number };

/**
 * A saving plan: put `amount` aside every week / month / year, starting on
 * `start` (when `startSaved` was already in the account). Amounts are in the
 * goal account's unit.
 */
export type SavingPlan = {
  every: Period;
  amount: number;
  start: string;
  startSaved: number;
  /** Day to reach the target by, when the amount was worked out from it. */
  deadline?: string;
};

export type Goal = Doc & {
  name: string;
  target: number;
  accountId: string;
  plan?: SavingPlan;
  /** Repeating transfer created with the plan (removed with the goal). */
  recurringId?: string;
};

export type RecurringKind = 'income' | 'expense' | 'transfer';

export type Recurring = Doc & {
  name: string;
  kind: RecurringKind;
  accountId: string;
  /** Destination for transfers (e.g. Sada9a / Zakat for scheduled top-ups). */
  toAccountId?: string;
  amount: number;
  rate?: number;
  categoryId?: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  /** Next due day (YYYY-MM-DD). */
  next: string;
  /** Add automatically, or wait for the user to confirm. */
  auto: boolean;
};

/** Zakat calculator settings (gold price and hawl start). */
export type ZakatState = Doc & { goldPrice: number; hawlStart: string | null };
