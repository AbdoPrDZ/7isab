import { useTranslation } from 'react-i18next';

import { usePrayerFormat } from '@/components/prayer/prayer-format';
import { weekOrder } from '@/lib/calendar/calendar';
import type { Alarm } from '@/lib/alarms/alarms';
import { useLedgerLabels } from '@/lib/ledger/hooks';

/** Short text for an alarm's time: "05:30" or "30 min before Fajr". */
export function useAlarmLabels() {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const { time: clock } = usePrayerFormat();

  const timeText = (alarm: Pick<Alarm, 'time'>) => {
    const time = alarm.time;
    if (time.kind === 'clock') {
      const date = new Date();
      date.setHours(time.hour, time.minute, 0, 0);
      return clock(date);
    }
    const prayer = t(`prayer.names.${time.prayer}`);
    if (!time.offset) return t('alarm.atPrayer', { prayer });
    return t(time.offset < 0 ? 'alarm.beforePrayer' : 'alarm.afterPrayer', {
      prayer,
      minutes: format.number(Math.abs(time.offset)),
    });
  };

  const repeatText = (alarm: Pick<Alarm, 'days'>) => {
    if (!alarm.days.length) return t('alarm.once');
    if (alarm.days.length === 7) return t('alarm.everyDay');
    return weekOrder()
      .filter((day) => alarm.days.includes(day))
      .map((day) => t(`task.days.${day}`))
      .join(' ');
  };

  return { timeText, repeatText };
}
