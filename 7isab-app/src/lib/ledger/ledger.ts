/**
 * Ledger rules: default records, balances, and the actions that add entries.
 * All configurable numbers default to 1 (the user changes them in settings).
 */
import { today } from '@/lib/dates';
import {
  deterministicId,
  getDoc,
  getDocs,
  getVaultMeta,
  newId,
  putDoc,
  putDocs,
  removeDoc,
  setVaultMeta,
} from '@/lib/data/vault';

import { ensureReasonPresets } from './reasons';
import {
  RecordTypes,
  type Account,
  type Entry,
  type EntryKind,
  type EntryLine,
  type ExchangeRate,
  type FixedAccountKey,
  type Rates,
  type Settings,
  type SinType,
} from './types';

export const FIXED_ACCOUNTS: { key: FixedAccountKey; unit: Account['unit'] }[] = [
  { key: 'akhira', unit: { kind: 'akhira' } },
  { key: 'thanb', unit: { kind: 'thanb' } },
  { key: 'sadaqa', unit: { kind: 'money' } },
  { key: 'zakat', unit: { kind: 'money' } },
  { key: 'cash', unit: { kind: 'money' } },
];

/** Starter wallet accounts (from the user's notes); normal accounts, can be renamed or archived. */
export const STARTER_ACCOUNTS: { key: string; name: string; role: Account['role']; unit: Account['unit'] }[] = [
  { key: 'ccp', name: 'CCP', role: 'wallet', unit: { kind: 'money' } },
  { key: 'eur', name: 'EUR', role: 'wallet', unit: { kind: 'money', currency: 'EUR' } },
  { key: 'debts', name: 'Debts', role: 'lent', unit: { kind: 'money' } },
  { key: 'owe', name: 'Debts I owe', role: 'borrowed', unit: { kind: 'money' } },
  { key: 'gold', name: 'Gold', role: 'savings', unit: { kind: 'gold' } },
];

export const DEFAULT_CURRENCY = 'DZD';

export const DEFAULT_RATES: Rates = { sadaqa: 1, zakat: 1, thanbCost: 1, thanbReward: 1, fastTap: 1 };

/** Preset sin types (names are translated by preset key; penalty defaults to 1). */
export const SIN_PRESETS = [
  'missedPrayer',
  'latePrayer',
  'backbiting',
  'lying',
  'anger',
  'lowerGaze',
  'wastedTime',
  'weakKhushoo',
  'homePrayer',
  'missedJumuah',
  'lateBedtime',
  'relapse',
];

/**
 * Starter accounts whose name was never changed are shown translated
 * ("Debts" → "Owed to me", "Debts I owe" → "I owe"…). Returns the starter key, or null.
 */
export function untouchedStarterKey(account: Account): string | null {
  for (const starter of STARTER_ACCOUNTS) {
    if (account.id === deterministicId(`account:starter:${starter.key}`) && account.name === starter.name) return starter.key;
  }
  return null;
}

export function fixedAccountId(key: FixedAccountKey): string {
  return deterministicId(`account:fixed:${key}`);
}

export function settingsId(): string {
  return deterministicId('settings');
}

/**
 * Creates the fixed accounts, settings and sin presets on this phone the first
 * time (stable ids, so two devices never create duplicates).
 */
export async function ensureDefaults(mainCurrency: string): Promise<void> {
  const missingAccounts = FIXED_ACCOUNTS.filter(({ key }) => !getDoc(RecordTypes.account, fixedAccountId(key)));
  if (missingAccounts.length) {
    await putDocs<Account>(
      RecordTypes.account,
      missingAccounts.map(({ key, unit }) => ({
        id: fixedAccountId(key),
        name: key,
        role: 'fixed',
        fixed: key,
        unit,
        order: FIXED_ACCOUNTS.findIndex((item) => item.key === key),
      })),
    );
  }

  // Starter accounts and their exchange rates (created once; deleting them is respected).
  if (!(await getVaultMeta('starter_accounts'))) {
    const missingStarters = STARTER_ACCOUNTS.filter(({ key }) => !getDoc(RecordTypes.account, deterministicId(`account:starter:${key}`)));
    if (missingStarters.length) {
      await putDocs<Account>(
        RecordTypes.account,
        missingStarters.map(({ key, name, role, unit }) => ({
          id: deterministicId(`account:starter:${key}`),
          name,
          role,
          unit,
          order: 10 + STARTER_ACCOUNTS.findIndex((item) => item.key === key),
        })),
      );
    }
    const rates: Omit<ExchangeRate, 'createdAt' | 'updatedAt'>[] = [
      { id: deterministicId('rate:EUR'), currency: 'EUR', rate: 1 },
      { id: deterministicId('rate:XAU_G'), currency: 'XAU_G', rate: 1 },
    ].filter((rate) => !getDocs<ExchangeRate>(RecordTypes.exchangeRate).some((item) => item.currency === rate.currency));
    if (rates.length) await putDocs<ExchangeRate>(RecordTypes.exchangeRate, rates);
    await setVaultMeta('starter_accounts', '1');
    await setVaultMeta('starter_owe', '1');
  }

  // Added later: money the user owes, separate from money owed to them. Created once for existing users too.
  if (!(await getVaultMeta('starter_owe'))) {
    const owe = STARTER_ACCOUNTS.find((item) => item.key === 'owe')!;
    const id = deterministicId('account:starter:owe');
    if (!getDoc(RecordTypes.account, id)) {
      await putDoc<Account>(RecordTypes.account, { id, name: owe.name, role: owe.role, unit: owe.unit, order: 14 });
    }
    await setVaultMeta('starter_owe', '1');
  }

  if (!getDoc(RecordTypes.settings, settingsId())) {
    await putDoc<Settings>(RecordTypes.settings, {
      id: settingsId(),
      mainCurrency,
      rates: DEFAULT_RATES,
      closedThrough: null,
      fastTapStrictness: 2,
    });
  } else if (!(await getVaultMeta('currency_default_dzd'))) {
    // Early builds defaulted to the phone's locale currency; the app's default is DZD.
    const settings = getSettings();
    if (settings.mainCurrency !== DEFAULT_CURRENCY) await updateSettings({ mainCurrency: DEFAULT_CURRENCY });
  }
  await setVaultMeta('currency_default_dzd', '1');

  const missingSins = SIN_PRESETS.filter((preset) => !getDoc(RecordTypes.sinType, deterministicId(`sin:${preset}`)));
  if (missingSins.length) {
    await putDocs<SinType>(
      RecordTypes.sinType,
      missingSins.map((preset) => ({
        id: deterministicId(`sin:${preset}`),
        name: '',
        preset,
        penalty: 1,
        order: SIN_PRESETS.indexOf(preset),
      })),
    );
  }

  await ensureReasonPresets();
}

export function getSettings(): Settings {
  const settings = getDoc<Settings>(RecordTypes.settings, settingsId());
  if (!settings) throw new Error('Settings are not ready');
  return settings;
}

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await putDoc<Settings>(RecordTypes.settings, { ...getSettings(), ...changes });
}

// ---- Balances ------------------------------------------------------------------

/** Rounds away float noise (4 decimals is enough for points and money). */
export function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function computeBalances(entries: Entry[], until?: string): Map<string, number> {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    if (until && entry.date > until) continue;
    for (const line of entry.lines) {
      balances.set(line.account, round((balances.get(line.account) ?? 0) + line.amount));
    }
  }
  return balances;
}

export function accountCurrency(account: Account, mainCurrency: string): string | null {
  if (account.unit.kind === 'money') return account.unit.currency ?? mainCurrency;
  if (account.unit.kind === 'gold') return null;
  return null;
}

/** Converts an amount of `currency` to the main currency (1 when no rate is set). */
export function toMain(amount: number, currency: string, mainCurrency: string, rates: ExchangeRate[]): number {
  if (currency === mainCurrency) return amount;
  const rate = rates.find((item) => item.currency === currency)?.rate ?? 1;
  return round(amount * rate);
}

// ---- Entries ---------------------------------------------------------------------

type EntryInput = {
  kind: EntryKind;
  lines: EntryLine[];
  date?: string;
  note?: string;
  id?: string;
} & Partial<Pick<Entry, 'taskId' | 'sinTypeId' | 'categoryId' | 'rate' | 'person'>>;

export async function addEntry(input: EntryInput): Promise<Entry> {
  const lines = input.lines.filter((line) => line.amount !== 0).map((line) => ({ ...line, amount: round(line.amount) }));
  return putDoc<Entry>(RecordTypes.entry, {
    ...input,
    id: input.id ?? newId(),
    date: input.date ?? today(),
    lines,
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await removeDoc(RecordTypes.entry, id);
}

const fixed = (key: FixedAccountKey) => fixedAccountId(key);

/** ذنب: Akhira −penalty, Thanb +penalty. */
export async function logSin(sin: SinType, note?: string, date?: string): Promise<Entry> {
  return addEntry({
    kind: 'sin',
    sinTypeId: sin.id,
    note,
    date,
    lines: [
      { account: fixed('akhira'), amount: -sin.penalty },
      { account: fixed('thanb'), amount: sin.penalty },
    ],
  });
}

/** Fast tapping while reading counts like a ذنب with its own penalty. */
export async function logFastTap(): Promise<Entry> {
  const penalty = getSettings().rates.fastTap;
  return addEntry({
    kind: 'fast_tap',
    lines: [
      { account: fixed('akhira'), amount: -penalty },
      { account: fixed('thanb'), amount: penalty },
    ],
  });
}

/** Paying T thanb points as sadaqa: Thanb −T, Sada9a −T×cost, Akhira +T×reward. Only from Sada9a. */
export async function payThanb(points: number, note?: string): Promise<Entry> {
  const { rates } = getSettings();
  return addEntry({
    kind: 'thanb_paid',
    note,
    lines: [
      { account: fixed('thanb'), amount: -points },
      { account: fixed('sadaqa'), amount: -points * rates.thanbCost },
      { account: fixed('akhira'), amount: points * rates.thanbReward },
    ],
  });
}

/** Giving sadaqa: Sada9a −X, Akhira +X × rate. Only from Sada9a. */
export async function giveSadaqa(amount: number, note?: string): Promise<Entry> {
  const { rates } = getSettings();
  return addEntry({
    kind: 'sadaqa',
    note,
    lines: [
      { account: fixed('sadaqa'), amount: -amount },
      { account: fixed('akhira'), amount: amount * rates.sadaqa },
    ],
  });
}

/** Paying zakat: Zakat −X, Akhira +X × rate. Only from Zakat. */
export async function payZakat(amount: number, note?: string): Promise<Entry> {
  const { rates } = getSettings();
  return addEntry({
    kind: 'zakat',
    note,
    lines: [
      { account: fixed('zakat'), amount: -amount },
      { account: fixed('akhira'), amount: amount * rates.zakat },
    ],
  });
}

/**
 * Moves money between two accounts. `rate` converts from the source currency
 * to the destination currency (1 when they match).
 */
export async function transfer(
  from: string,
  to: string,
  amount: number,
  options: { rate?: number; note?: string; kind?: 'transfer' | 'top_up' | 'loan'; person?: string; date?: string } = {},
): Promise<Entry> {
  const rate = options.rate ?? 1;
  return addEntry({
    kind: options.kind ?? 'transfer',
    note: options.note,
    person: options.person,
    date: options.date,
    rate: rate === 1 ? undefined : rate,
    lines: [
      { account: from, amount: -amount },
      { account: to, amount: amount * rate },
    ],
  });
}

/** Income (positive) or expense (negative amount handled here) on one account. */
export async function addIncomeOrExpense(
  kind: 'income' | 'expense',
  account: string,
  amount: number,
  options: { categoryId?: string; note?: string; date?: string } = {},
): Promise<Entry> {
  return addEntry({
    kind,
    categoryId: options.categoryId,
    note: options.note,
    date: options.date,
    lines: [{ account, amount: kind === 'income' ? amount : -amount }],
  });
}

export function listAccounts(): Account[] {
  return getDocs<Account>(RecordTypes.account).sort((a, b) => a.order - b.order);
}
