import { useEffect, useState } from 'react';
import { getConfig } from '../config';
import { DEMO_USER_ID, LOCAL_USER_ID } from '../data/localRepo';
import { getSupabase } from '../lib/supabase';
import type { SessionStatus } from './gate';
import { endGuest, isGuest, subscribeGuest } from './guest';

export interface SessionState {
  status: SessionStatus;
  userId: string | null;
}

const GUEST: SessionState = { status: 'guest', userId: LOCAL_USER_ID };
const SIGNED_OUT: SessionState = { status: 'signedOut', userId: null };

function initialState(): SessionState {
  const { mode } = getConfig();
  if (mode === 'demo') return { status: 'signedIn', userId: DEMO_USER_ID };
  if (mode === 'guest') return GUEST;
  return { status: 'loading', userId: null };
}

function resolve(userId: string | null | undefined, guest: boolean): SessionState {
  if (userId) return { status: 'signedIn', userId };
  return guest ? GUEST : SIGNED_OUT;
}

function keepIfSame(prev: SessionState, next: SessionState): SessionState {
  return prev.status === next.status && prev.userId === next.userId ? prev : next;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(initialState);

  useEffect(() => {
    if (getConfig().mode !== 'supabase') return;
    const supabase = getSupabase();
    let active = true;
    let sessionUserId: string | null | undefined;
    const apply = async () => {
      let guest = await isGuest().catch(() => false);
      if (sessionUserId && guest) {
        await endGuest().catch(() => {});
        guest = false;
      }
      if (active) setState((prev) => keepIfSame(prev, resolve(sessionUserId, guest)));
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        sessionUserId = data.session?.user.id;
      })
      .catch(() => {
        sessionUserId = null;
      })
      .then(apply);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionUserId = session?.user.id ?? null;
      void apply();
    });
    const unsubscribeGuest = subscribeGuest(() => void apply());
    return () => {
      active = false;
      data.subscription.unsubscribe();
      unsubscribeGuest();
    };
  }, []);

  return state;
}
