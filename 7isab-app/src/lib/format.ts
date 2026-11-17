/**
 * Number, money and date formatting with Intl for the active language, then
 * the digits the user chose (Intl's numbering-system support varies between
 * JS engines, so digits are swapped by hand).
 */
import { useTranslation } from 'react-i18next';

import { fromDay } from '@/lib/dates';
import { useDigitPreference, type DigitPreference } from '@/lib/preferences/digits';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

export function applyDigits(text: string, digits: DigitPreference): string {
  if (digits === 'arab') return text.replace(/[0-9]/g, (digit) => ARABIC_INDIC[Number(digit)]);
  return text.replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)));
}

/** Intl locale for a language, with Latin digits (the digits are applied afterwards). */
function locale(language: string): string {
  return `${language}-u-nu-latn`;
}

export type Formatter = {
  number: (value: number, maximumFractionDigits?: number) => string;
  /** Money in a currency code (e.g. DZD); falls back to "1,000.00 XXX" for unknown codes. */
  money: (value: number, currency: string) => string;
  points: (value: number) => string;
  /** A "YYYY-MM-DD" day. */
  day: (day: string, style?: 'short' | 'long') => string;
  month: (month: string) => string;
  /** Any text containing digits (applies the digits preference). */
  digits: (text: string | number) => string;
};

export function createFormatter(language: string, digits: DigitPreference): Formatter {
  const loc = locale(language);
  const cache = new Map<string, Intl.NumberFormat>();
  const numberFormat = (key: string, options: Intl.NumberFormatOptions) => {
    let format = cache.get(key);
    if (!format) {
      format = new Intl.NumberFormat(loc, options);
      cache.set(key, format);
    }
    return format;
  };

  return {
    number: (value, maximumFractionDigits = 2) =>
      applyDigits(numberFormat(`n${maximumFractionDigits}`, { maximumFractionDigits }).format(value), digits),
    money: (value, currency) => {
      let text: string;
      try {
        text = numberFormat(`m${currency}`, { style: 'currency', currency, currencyDisplay: 'code' }).format(value);
      } catch {
        text = `${numberFormat('n2', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
      }
      return applyDigits(text, digits);
    },
    points: (value) => applyDigits(numberFormat('p', { maximumFractionDigits: 2 }).format(value), digits),
    day: (day, style = 'short') => {
      try {
        const text = new Intl.DateTimeFormat(
          loc,
          style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' },
        ).format(fromDay(day));
        return applyDigits(text, digits);
      } catch {
        return applyDigits(day, digits);
      }
    },
    month: (month) => {
      try {
        const [year, value] = month.split('-').map(Number);
        return applyDigits(
          new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(new Date(year, value - 1, 1)),
          digits,
        );
      } catch {
        return applyDigits(month, digits);
      }
    },
    digits: (text) => applyDigits(String(text), digits),
  };
}

/** The formatter for the current language and digits preference. */
export function useFormat(): Formatter {
  const { i18n } = useTranslation();
  const digits = useDigitPreference();
  return createFormatter(i18n.language, digits);
}

/** Parses a number typed with Western or Arabic-Indic digits and either decimal mark. */
export function parseAmount(text: string): number | null {
  const normalized = applyDigits(text, 'latn').replace(/[٫,]/g, '.').replace(/[^0-9.\-]/g, '');
  if (!normalized || normalized === '.' || normalized === '-') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
