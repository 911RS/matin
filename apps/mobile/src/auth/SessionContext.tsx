import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AppConfig } from '../config';
import type { SessionState } from './useSession';

export interface AppSession {
  session: SessionState;
  mode: AppConfig['mode'];
}

const SessionContext = createContext<AppSession | null>(null);

export function SessionProvider({ value, children }: { value: AppSession; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAppSession(): AppSession {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useAppSession must be used inside SessionProvider');
  return value;
}

export function isCloudAccount({ session, mode }: AppSession): boolean {
  return mode === 'supabase' && session.status === 'signedIn';
}
