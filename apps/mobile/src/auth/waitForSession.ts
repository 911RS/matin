import type { Session, SupabaseClient } from '@supabase/supabase-js';

export const SESSION_WAIT_MS = 10000;

export type SessionClient = {
  auth: Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange'>;
};

export function waitForSession(client: SessionClient, timeoutMs = SESSION_WAIT_MS): Promise<Session | null> {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (session: Session | null) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
      resolve(session);
    };
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) finish(session);
    });
    unsubscribe = () => data.subscription.unsubscribe();
    timer = setTimeout(() => finish(null), timeoutMs);
    client.auth
      .getSession()
      .then(({ data: result }) => {
        if (result.session) finish(result.session);
      })
      .catch(() => {});
  });
}
