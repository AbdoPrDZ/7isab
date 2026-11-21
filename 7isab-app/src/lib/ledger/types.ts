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
  reason: 'reason',
  reportNote: 'report_note',
  program: 'program',
  relapse: 'relapse',
  statsFilter: 'stats_filter',
  testament: 'testament',
  profile: 'profile',
  investment: 'investment',
} as const;

export type FixedAccountKey = 'akhira' | 'thanb' | 'sadaqa' | 'zakat' | 'cash';

/** What an account counts. 'money' without a currency uses the main currency. */
export type AccountUnit =
  | { kind: 'akhira' }
  | { kind: 'thanb' }
  | { kind: 'money'; currency?: string }
  | { kind: 'gold' };

/** `investment`: the capital of one investment (lib/investments), shown under Investments, not in the wallet list. */
export type AccountRole = 'fixed' | 'wallet' | 'lent' | 'borrowed' | 'savings' | 'investment';

export type Account = Doc & {
  name: string;
  role: AccountRole;
  fixed?: FixedAccountKey;
  unit: AccountUnit;
  archived?: boolean;
  hidden?: boolean;
  /** Left out of the zakat calculation (e.g. an asset rented out: zakat is due on the rent, not the asset). */
  zakatExempt?: boolean;
  color?: string;
  order: number;
};

export type EntryKind =
  | 'task_done'
  | 'task_missed'
  /** A prayer counted as missed / prayed late (Thanb, from the matching sin type). */
  | 'prayer_missed'
  | 'prayer_late'
  /** Slept after bedtime + grace with a Thanb reason, or the night was never marked (Late bedtime sin type). */
  | 'bedtime_late'
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
  /** Capital, profit, loss or withdrawal of an investment (lib/investments). */
  investmentId?: string;
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
  /** Bedtime task (missing = defaults, see lib/bedtime). */
  bedtime?: BedtimeSettings;
  /** Report notifications and rating thresholds (missing = defaults, see lib/reports). */
  reports?: ReportSettings;
  /** Home shows the weekly Akhira points, reset every Saturday 00:00 (see lib/ledger/weekly). */
  weeklyAkhira?: boolean;
  /** Testament reminders per category (missing = defaults, see lib/testaments). */
  testaments?: Partial<Record<TestamentCategory, TestamentSchedule>>;
};

/** Testaments (توصيات): reminders of Jannah, Nar, advice for the Akhira and the Dunya, and athkar to say. */
export type TestamentCategory = 'jannah' | 'nar' | 'akhira' | 'dunya' | 'athkar';

export type Testament = Doc & {
  category: TestamentCategory;
  /** The user's text ('' for presets: their text comes from lib/testaments/presets). */
  text: string;
  /** Where it's from (a book, a person…), optional. */
  source?: string;
  /** Preset key (built-in Testament). */
  preset?: string;
  enabled: boolean;
  order: number;
};

/** When a category's Testaments notify. Times are minutes since 00:00. */
export type TestamentSchedule = {
  enabled: boolean;
  /** Random reminders per day inside [from, to). */
  random: number;
  from: number;
  to: number;
  /** Fixed times, every day. */
  times: number[];
};

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

export type ReportSettings = {
  /** Time of the report notifications. */
  hour: number;
  minute: number;
  /** Which reports notify (each on its period's last day). */
  notify: Record<ReportPeriod, boolean>;
  /** Score thresholds, in %. */
  goodAt: number;
  normalAt: number;
};

/** Bedtime: on time when asleep by hour:minute + grace minutes. */
export type BedtimeSettings = { enabled: boolean; hour: number; minute: number; grace: number };

export type TaskKind = 'quran' | 'athkar' | 'custom' | 'prayer' | 'nafilah' | 'fasting' | 'bedtime';
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
  /** The program this task belongs to (at most one). */
  programId?: string;
  /** Plain task: never counted in the hisab (no reward, no penalty) and never in a rating. */
  plain?: boolean;
};

/** improving / healing are translated; custom uses `customCategory`. */
export type ProgramCategory = 'improving' | 'healing' | 'custom';

/**
 * A plan (improving, healing from a habit, or a custom category) with its own
 * tasks. Healing programs also track clean days and relapses.
 */
export type Program = Doc & {
  name: string;
  category: ProgramCategory;
  customCategory?: string;
  goal?: string;
  startDate: string;
  /** Last day (YYYY-MM-DD), or none for an open-ended program. */
  endDate?: string | null;
  /** Finished or stopped: kept with its history, no longer shown as active. */
  archived?: boolean;
};

/** A relapse in a healing program; with `thanb`, a "Relapse" Thanb entry (id fixed from the relapse). */
export type Relapse = Doc & { programId: string; date: string; note?: string; thanb: boolean };

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
  /** Prayers: khushoo level (weak adds a Thanb). */
  khushoo?: Khushoo;
  /** Prayers: where it was prayed. */
  place?: PrayerPlace;
  /** Prayers at home: the reason picked (a Reason id) and its text at the time. */
  placeReasonId?: string;
  placeReason?: string;
  /** Bedtime: when the user went to sleep (ms). */
  sleptAt?: number;
  /** Bedtime when late: the reason picked (a Reason id); its text is in `cause`. */
  reasonId?: string;
};

export type Khushoo = 'good' | 'normal' | 'weak';
export type PrayerPlace = 'mosque' | 'home';

/** onTime: in its time (or marked later as such); late: after its time (qada); combined: jam' with its pair. */
export type PrayerStatus = 'onTime' | 'late' | 'combined';

export type SinType = Doc & { name: string; penalty: number; order: number; preset?: string };

/** Where a reason list is used. */
export type ReasonScope = 'homePrayer' | 'bedtime';

/**
 * A reason the user picks (e.g. why a prayer was prayed at home). Presets are
 * translated by key; `thanb` decides whether picking it adds a Thanb.
 */
export type Reason = Doc & { scope: ReasonScope; name: string; preset?: string; thanb: boolean; order: number };

/** 1 unit of `currency` = `rate` units of the main currency. Gold uses currency "XAU_G" (per gram). */
export type ExchangeRate = Doc & { currency: string; rate: number };

export const GOLD_CURRENCY = 'XAU_G';
