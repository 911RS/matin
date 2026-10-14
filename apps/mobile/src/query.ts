import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { defaultShouldDehydrateQuery, onlineManager, QueryClient } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import { withBase } from './pwa/basePath';

export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: CACHE_MAX_AGE, networkMode: 'offlineFirst' },
      mutations: { networkMode: 'online' },
    },
  });
}

export function shouldDehydrateQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  if (query.queryKey[0] !== 'image') return true;
  const data: unknown = query.state.data;
  return typeof data === 'string' && data.startsWith('https://');
}

export const dehydrateOptions = { shouldDehydrateQuery } as const;

export const persister = createAsyncStoragePersister({ storage: AsyncStorage });

export function wireOnlineManager(): () => void {
  if (Platform.OS === 'web') NetInfo.configure({ reachabilityUrl: withBase('/') });
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    }),
  );
  return () => onlineManager.setEventListener(() => () => {});
}
