import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import type { SessionState } from '../auth/useSession';

export const CACHE_OWNER_KEY = 'tenue-cache-owner';

export function shouldResetCache(prevOwner: string | null, userId: string | null): boolean {
  return prevOwner !== userId;
}

export function cacheBuster(userId: string | null): string {
  return `v1:${userId ?? 'anon'}`;
}

export async function readCacheOwner(): Promise<string | null> {
  return AsyncStorage.getItem(CACHE_OWNER_KEY);
}

export async function writeCacheOwner(userId: string | null): Promise<void> {
  if (userId) await AsyncStorage.setItem(CACHE_OWNER_KEY, userId);
  else await AsyncStorage.removeItem(CACHE_OWNER_KEY);
}

export function clearClientCache(client: QueryClient): void {
  client.getMutationCache().clear();
  client.clear();
}

export function useCacheScope(
  client: QueryClient,
  session: SessionState,
  persister: Pick<Persister, 'removeClient'>,
): boolean {
  const known = session.status !== 'loading';
  const userId = session.userId;
  const [scope, setScope] = useState<{ userId: string | null } | null>(null);
  const lastUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!known) return;
    let active = true;
    if (lastUser.current !== undefined && shouldResetCache(lastUser.current, userId)) clearClientCache(client);
    lastUser.current = userId;
    (async () => {
      const prev = await readCacheOwner();
      if (!active || !shouldResetCache(prev, userId)) return;
      clearClientCache(client);
      if (!active) return;
      await persister.removeClient();
      if (!active) return;
      await writeCacheOwner(userId);
    })()
      .catch(() => {})
      .finally(() => {
        if (active) setScope({ userId });
      });
    return () => {
      active = false;
    };
  }, [known, userId, client, persister]);

  return known && scope !== null && scope.userId === userId;
}
