/**
 * Reasons the user picks from a list, per scope (e.g. why a prayer was prayed
 * at home). Each reason says whether picking it adds a Thanb. Presets are
 * created once with fixed ids (so two devices never duplicate them) and
 * translated by key; the user can add, rename, switch or delete reasons.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import { deterministicId, getDoc, getDocs, putDocs, useDocs } from '@/lib/data/vault';

import { RecordTypes, type Reason, type ReasonScope } from './types';

/** Preset key → adds a Thanb. Excused reasons first. */
export const REASON_PRESETS: Record<ReasonScope, [key: string, thanb: boolean][]> = {
  homePrayer: [
    ['illness', false],
    ['travel', false],
    ['rain', false],
    ['work', false],
    ['noMosque', false],
    ['laziness', true],
    ['busy', true],
    ['overslept', true],
  ],
  bedtime: [
    ['work', false],
    ['illness', false],
    ['travel', false],
    ['family', false],
    ['phone', true],
    ['tv', true],
    ['chatting', true],
    ['wastedTime', true],
  ],
};

function presetId(scope: ReasonScope, key: string): string {
  return deterministicId(`reason:${scope}:${key}`);
}

/** Creates the preset reasons that don't exist yet. */
export async function ensureReasonPresets(): Promise<void> {
  const missing: Omit<Reason, 'createdAt' | 'updatedAt'>[] = [];
  for (const scope of Object.keys(REASON_PRESETS) as ReasonScope[]) {
    REASON_PRESETS[scope].forEach(([key, thanb], order) => {
      const id = presetId(scope, key);
      if (!getDoc(RecordTypes.reason, id)) missing.push({ id, scope, name: '', preset: key, thanb, order });
    });
  }
  if (missing.length) await putDocs<Reason>(RecordTypes.reason, missing);
}

function sortReasons(reasons: Reason[]): Reason[] {
  return [...reasons].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function getReasons(scope: ReasonScope): Reason[] {
  return sortReasons(getDocs<Reason>(RecordTypes.reason).filter((reason) => reason.scope === scope));
}

export function useReasons(scope: ReasonScope): Reason[] {
  const all = useDocs<Reason>(RecordTypes.reason);
  return useMemo(() => sortReasons(all.filter((reason) => reason.scope === scope)), [all, scope]);
}

/** A reason's display name in the current language (presets are translated). */
export function reasonLabel(reason: Reason): string {
  return reason.preset ? i18n.t(`reasons.${reason.scope}.${reason.preset}`, { defaultValue: reason.name }) : reason.name;
}

/** reasonLabel that re-renders when the language changes. */
export function useReasonName(): (reason: Reason) => string {
  const { t } = useTranslation();
  return (reason) => (reason.preset ? t(`reasons.${reason.scope}.${reason.preset}`, { defaultValue: reason.name }) : reason.name);
}
