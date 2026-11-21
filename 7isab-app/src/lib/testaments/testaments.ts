/**
 * Testaments (توصيات): short reminders of Jannah and Nar, and advice for the
 * Akhira and the Dunya, sent as notifications at random and / or fixed times,
 * per category. Built-in ones are created once with fixed ids (two devices
 * never duplicate them) and can be switched off; the user adds their own.
 */
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import { deterministicId, getDoc, getDocs, newId, putDoc, putDocs, removeDoc, useDocs } from '@/lib/data/vault';
import { useSettings } from '@/lib/ledger/hooks';
import { getSettings, updateSettings } from '@/lib/ledger/ledger';
import {
  RecordTypes,
  type Settings,
  type Testament,
  type TestamentCategory,
  type TestamentSchedule,
} from '@/lib/ledger/types';

import { PRESETS_BY_KEY, TESTAMENT_PRESETS } from './presets';

export const TESTAMENT_CATEGORIES: TestamentCategory[] = ['jannah', 'nar', 'akhira', 'dunya', 'athkar'];

/** One random reminder a day between 08:00 and 22:00, no fixed time. */
export const DEFAULT_SCHEDULE: TestamentSchedule = { enabled: true, random: 1, from: 8 * 60, to: 22 * 60, times: [] };

/** Most random reminders per category per day. */
export const MAX_RANDOM = 10;

function presetId(key: string): string {
  return deterministicId(`testament:${key}`);
}

/** Creates the built-in Testaments that don't exist yet. */
export async function ensureTestamentPresets(): Promise<void> {
  const missing: Omit<Testament, 'createdAt' | 'updatedAt'>[] = [];
  TESTAMENT_PRESETS.forEach((preset, order) => {
    const id = presetId(preset.key);
    if (!getDoc(RecordTypes.testament, id)) {
      missing.push({ id, category: preset.category, text: '', preset: preset.key, enabled: true, order });
    }
  });
  if (missing.length) await putDocs<Testament>(RecordTypes.testament, missing);
}

function sortTestaments(list: Testament[]): Testament[] {
  return [...list].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function getTestaments(): Testament[] {
  return sortTestaments(getDocs<Testament>(RecordTypes.testament));
}

export function useTestaments(): Testament[] {
  const all = useDocs<Testament>(RecordTypes.testament);
  return useMemo(() => sortTestaments(all), [all]);
}

export function useTestament(id: string | undefined): Testament | undefined {
  const all = useDocs<Testament>(RecordTypes.testament);
  return id ? all.find((testament) => testament.id === id) : undefined;
}

export async function saveTestament(
  values: Pick<Testament, 'category' | 'text' | 'enabled'> & { id?: string; source?: string },
): Promise<void> {
  const existing = values.id ? getDoc<Testament>(RecordTypes.testament, values.id) : undefined;
  await putDoc<Testament>(RecordTypes.testament, {
    ...existing,
    id: existing?.id ?? newId(),
    category: values.category,
    text: existing?.preset ? '' : values.text.trim(),
    source: existing?.preset ? undefined : values.source?.trim() || undefined,
    preset: existing?.preset,
    enabled: values.enabled,
    order: existing?.order ?? Date.now(),
  });
}

export async function setTestamentEnabled(testament: Testament, enabled: boolean): Promise<void> {
  await putDoc<Testament>(RecordTypes.testament, { ...testament, enabled });
}

/** Only the user's own Testaments are deleted; built-in ones are switched off. */
export async function deleteTestament(testament: Testament): Promise<void> {
  if (testament.preset) return setTestamentEnabled(testament, false);
  await removeDoc(RecordTypes.testament, testament.id);
}

/** What a Testament says and where it's from, in the current language. */
/** `ayah`: Quran text (Quran font); `arabic`: always shown right-to-left in Arabic (ayat and athkar). */
export type TestamentContent = { text: string; source: string | null; ayah: boolean; arabic: boolean };

export function testamentContent(testament: Testament, t: TFunction = i18n.t): TestamentContent {
  const preset = testament.preset ? PRESETS_BY_KEY.get(testament.preset) : undefined;
  if (preset?.kind === 'ayah') {
    return {
      text: `﴿${preset.text}﴾`,
      source: t('testaments.ayahSource', { surah: t(`testaments.surahs.${preset.surah}`), ayat: preset.ayat }),
      ayah: true,
      arabic: true,
    };
  }
  if (preset?.kind === 'dhikr') return { text: preset.text, source: null, ayah: false, arabic: true };
  if (preset) return { text: t(`testaments.advice.${preset.key}`), source: null, ayah: false, arabic: false };
  return { text: testament.text, source: testament.source ?? null, ayah: false, arabic: false };
}

/** testamentContent that re-renders when the language changes. */
export function useTestamentContent(): (testament: Testament) => TestamentContent {
  const { t } = useTranslation();
  return (testament) => testamentContent(testament, t);
}

// ---- Schedule ------------------------------------------------------------------------

export function scheduleOf(settings: Settings | undefined, category: TestamentCategory): TestamentSchedule {
  return { ...DEFAULT_SCHEDULE, ...settings?.testaments?.[category] };
}

export function getTestamentSchedules(): Record<TestamentCategory, TestamentSchedule> {
  const settings = getSettings();
  return Object.fromEntries(TESTAMENT_CATEGORIES.map((category) => [category, scheduleOf(settings, category)])) as Record<
    TestamentCategory,
    TestamentSchedule
  >;
}

export function useTestamentSchedule(category: TestamentCategory): TestamentSchedule {
  return scheduleOf(useSettings(), category);
}

export async function updateTestamentSchedule(category: TestamentCategory, changes: Partial<TestamentSchedule>): Promise<void> {
  const settings = getSettings();
  const next = { ...scheduleOf(settings, category), ...changes };
  next.times = [...new Set(next.times)].sort((a, b) => a - b);
  await updateSettings({ testaments: { ...settings?.testaments, [category]: next } });
}
