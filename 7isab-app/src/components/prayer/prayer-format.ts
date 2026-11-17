import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLedgerLabels } from '@/lib/ledger/hooks';

/** The current time, updated every `intervalMs` (for countdowns). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "13:05" in the app language, with the user's digits preference. */
export function usePrayerFormat() {
  const { t, i18n } = useTranslation();
  const { format } = useLedgerLabels();

  const time = (date: Date) => {
    let text: string;
    try {
      text = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    } catch {
      text = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    return format.digits(text);
  };

  /** "in 2 h 05 min" / "in 12 min". */
  const countdown = (target: Date, now: Date) => {
    const minutes = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60_000));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours
      ? t('prayer.inHours', { hours: format.number(hours), minutes: format.digits(String(rest).padStart(2, '0')) })
      : t('prayer.inMinutes', { minutes: format.number(rest) });
  };

  return { time, countdown };
}
