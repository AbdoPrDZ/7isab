/**
 * The user's community membership, loaded once when the community opens.
 * The community layout provides it; every community screen reads it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/session/session-provider';

import { getMembership } from './api';
import type { CommunityRule, Membership } from './types';

export type MembershipState =
  | { status: 'loading' }
  | { status: 'error'; network: boolean }
  /** Never joined, or left (rejoining keeps the gender). */
  | { status: 'outside'; profile: Membership['profile'] }
  | { status: 'blocked'; reason: 'suspended' | 'banned' }
  | { status: 'pendingRules'; profile: NonNullable<Membership['profile']>; rules: CommunityRule[] }
  | { status: 'member'; profile: NonNullable<Membership['profile']> };

type MembershipContextValue = {
  state: MembershipState;
  /** Reloads from the server (after joining, accepting rules, leaving or editing). */
  refresh: () => Promise<void>;
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

function stateOf({ profile, pending_rules }: Membership): MembershipState {
  if (!profile || profile.status === 'left') return { status: 'outside', profile };
  if (profile.status === 'suspended' || profile.status === 'banned') return { status: 'blocked', reason: profile.status };
  if (pending_rules.length) return { status: 'pendingRules', profile, rules: pending_rules };
  return { status: 'member', profile };
}

async function fetchState(token: string | null): Promise<MembershipState> {
  try {
    return stateOf(await getMembership(token));
  } catch (error) {
    return { status: 'error', network: error instanceof ApiError && error.isNetworkError };
  }
}

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const [state, setState] = useState<MembershipState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState(await fetchState(token));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetchState(token).then((next) => !cancelled && setState(next));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(() => ({ state, refresh }), [state, refresh]);

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership(): MembershipContextValue {
  const value = useContext(MembershipContext);
  if (!value) throw new Error('useMembership must be used inside MembershipProvider');
  return value;
}

/** The member's profile; only for screens shown to members. */
export function useMemberProfile(): NonNullable<Membership['profile']> {
  const { state } = useMembership();
  if (state.status !== 'member') throw new Error('useMemberProfile needs an active member');
  return state.profile;
}

/** A rule's text in the current language (English when missing). */
export function ruleText(rule: CommunityRule, language: string): string {
  return rule.texts[language as keyof CommunityRule['texts']] || rule.texts.en;
}
