/**
 * Ledger model. Everything is an entry that changes one or more accounts;
 * an account's balance is the sum of its entry lines. Entries are only added
 * (corrections are new entries or deleting a whole entry).
 */
import type { Doc } from '@/lib/data/vault';

export const RecordTypes = {
  settings: 'settings',
  account: 'account',
  entry: 'entry',
  task: 'task',
  progress: 'progress',
  sinType: 'sin_type',
  exchangeRate: 'exchange_rate',
  category: 'category',
  budget: 'budget',
  goal: 'goal',
  recurring: 'recurring',
  reading: 'reading',
  readingDay: 'reading_day',
  athkar: 'athkar',
  athkarDay: 'athkar_day',
  zakatState: 'zakat_state',
  prayerSettings: 'prayer_settings',
  alarm: 'alarm',
} as const;

export type FixedAccountKey = 'akhira' | 'thanb' | 'sadaqa' | 'zakat' | 'cash';

/** What an account counts. 'money' without a currency uses the main currency. */
export type AccountUnit =
  | { kind: 'akhira' }
  | { kind: 'thanb' }
  | { kind: 'money'; currency?: string }
  | { kind: 'gold' };

export type AccountRole = 'fixed' | 'wallet' | 'lent' | 'borrowed' | 'savings';

export type Account = Doc & {
  name: string;
  role: AccountRole;
  fixed?: FixedAccountKey;
  unit: AccountUnit;
  archived?: boolean;
  hidden?: boolean;
  color?: string;
  order: number;
};

export type EntryKind =
  | 'task_done'
  | 'task_missed'
  /** A prayer counted as missed / prayed late (Thanb, from the matching sin type). */
  | 'prayer_missed'
  | 'prayer_late'
  | 'sin'
  | 'fast_tap'
  | 'thanb_paid'
  | 'sadaqa'
  | 'zakat'
  | 'top_up'
  | 'income'
  | 'expense'
  | 'transfer'
  | 'loan'
  | 'adjustment';

export type EntryLine = { account: string; amount: number };

export type Entry = Doc & {
  kind: EntryKind;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  lines: EntryLine[];
  note?: string;
  taskId?: string;
  sinTypeId?: string;
  categoryId?: string;
  /** Exchange rate used for a transfer between currencies. */
  rate?: number;
  /** For loans: who the money was lent to / borrowed from. */
  person?: string;
};

export type Rates = {
  /** Akhira points per currency unit of sadaqa. */
  sadaqa: number;
  /** Akhira points per currency unit of zakat. */
  zakat: number;
  /** Currency units paid per Thanb point. */
  thanbCost: number;
  /** Akhira points gained per Thanb point paid. */
  thanbReward: number;
  /** Penalty for fast tapping while reading. */
  fastTap: number;
};

export type Settings = Doc & {
  mainCurrency: string;
  rates: Rates;
  /** The last day the end-of-day check turned into entries (YYYY-MM-DD). */
  closedThrough: string | null;
  /** Fast-tap strictness: 0 = off, 1 = relaxed, 2 = normal, 3 = strict. */
  fastTapStrictness: number;
  /** Daily reminder of the tasks not done yet (null / missing = off). */
  taskReminder?: { hour: number; minute: number } | null;
};

export type TaskKind = 'quran' | 'athkar' | 'custom' | 'prayer' | 'nafilah' | 'fasting';
/** Voluntary prayers. */
export type NafilahType = 'rawatib' | 'duha' | 'witr' | 'qiyam' | 'tahajjud' | 'other';
/** Fasting presets; each sets the days the task is due. */
export type FastingPreset = 'ramadan' | 'mondayThursday' | 'whiteDays' | 'arafah' | 'ashura' | 'shawwal' | 'custom';
export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
/** check = done / not done; count = any counter; pages / words = Quran reading; rakahs = prayer units; days = days fasted. */
/** hizb / rub / thumn = Quran divisions (a hizb is 4 rub' or 8 thumn); fractions count. */
export type TaskTarget = {
  unit: 'check' | 'count' | 'pages' | 'words' | 'hizb' | 'rub' | 'thumn' | 'rakahs' | 'days';
  amount: number;
};
/**
 * daily, or on chosen weekdays (0 = Sunday … 6 = Saturday): the target is for
 * each day. weekly / monthly / yearly: the target is for the whole period
 * (weeks start on Saturday) and the period is counted once it's over.
 */
export type TaskRepeat =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'weekly' }
  | { kind: 'monthly' }
  | { kind: 'yearly' }
  /** On matching Hijri days (empty list = any): e.g. Ramadan = months [9]; White Days = days [13, 14, 15]. */
  | { kind: 'hijri'; months: number[]; days: number[] }
  /** Target for the whole Hijri month (e.g. 6 days of Shawwal = months [10]). */
  | { kind: 'hijriMonth'; months: number[] };

export type PeriodRepeatKind = 'weekly' | 'monthly' | 'yearly';

export type Task = Doc & {
  title: string;
  kind: TaskKind;
  target: TaskTarget;
  repeat: TaskRepeat;
  reward: number;
  penalty: number;
  /** First day the task counts (YYYY-MM-DD). */
  startDate: string;
  archived?: boolean;
  /** For athkar tasks: which list feeds the progress. */
  athkarListId?: string;
  /** For prayer tasks (made automatically, one per prayer). */
  prayer?: PrayerName;
  nafilah?: NafilahType;
  fasting?: FastingPreset;
};

/** Progress of one task on one day (for period tasks, date = the period's first day). Id = stable(taskId + date). */
export type TaskProgress = Doc & {
  taskId: string;
  date: string;
  value: number;
  /** Prayers: how it was prayed. */
  status?: PrayerStatus;
  /** Prayers: why it was late (required) or combined (optional). */
  cause?: string;
  /** Prayers: the prayer it was combined with (jam'). */
  combinedWith?: PrayerName;
  /** Prayers: when it was prayed (ms); decides on time / late against its safe time. */
  prayedAt?: number;
};

/** onTime: in its time (or marked later as such); late: after its time (qada); combined: jam' with its pair. */
export type PrayerStatus = 'onTime' | 'late' | 'combined';

export type SinType = Doc & { name: string; penalty: number; order: number; preset?: string };

/** 1 unit of `currency` = `rate` units of the main currency. Gold uses currency "XAU_G" (per gram). */
export type ExchangeRate = Doc & { currency: string; rate: number };

export const GOLD_CURRENCY = 'XAU_G';
