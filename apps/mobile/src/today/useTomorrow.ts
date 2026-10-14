import { useMemo } from 'react';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { Weather } from '@tenue/engine';
import type { ProfileRow } from '@tenue/backend';
import { weatherKey, todayKey, tomorrowKey } from '../data/keys';
import { useRepo } from '../data/RepoProvider';
import { cachedReads, flowReads } from './useToday';
import { offlineTomorrow, previewTomorrow, tomorrowOf, loadWeather } from './flows';
import type { FlowDeps, WeatherFor } from './flows';
import type { TodayState } from './types';

const WEATHER_STALE_MS = 30 * 60 * 1000;

export function cachedWeatherFor(queryClient: QueryClient, deps: FlowDeps): WeatherFor {
  return async (profile: ProfileRow, date: string): Promise<Weather> => {
    const key = weatherKey(profile.lat, profile.lon, date);
    const weather = await queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => loadWeather(deps, profile, date),
      staleTime: WEATHER_STALE_MS,
    });
    if (weather.assumed) queryClient.removeQueries({ queryKey: key, exact: true });
    return weather;
  };
}

export interface TomorrowApi {
  date: string;
  state: TodayState | undefined;
  status: 'pending' | 'error' | 'success';
  offline: boolean;
  refetch: () => void;
}

export function useTomorrow(today: string, enabled: boolean, now: () => Date, fetchFn: typeof fetch): TomorrowApi {
  const repo = useRepo();
  const queryClient = useQueryClient();
  const date = tomorrowOf(today);
  const deps = useMemo<FlowDeps>(
    () => ({ repo, now, fetchFn, reads: flowReads(queryClient, repo) }),
    [repo, now, fetchFn, queryClient],
  );
  const query = useQuery({
    queryKey: tomorrowKey(date),
    queryFn: async () => {
      const todayState = queryClient.getQueryData<TodayState>(todayKey(today));
      return previewTomorrow(deps, today, {
        weatherFor: cachedWeatherFor(queryClient, deps),
        todayRow: todayState?.kind === 'outfit' ? todayState.row : null,
      });
    },
    enabled,
    staleTime: 0,
  });
  const offline = query.data === undefined && (query.fetchStatus === 'paused' || (query.isError && !onlineManager.isOnline()));
  const fallback = useMemo<TodayState | undefined>(() => {
    if (!offline) return undefined;
    const cache = cachedReads(queryClient);
    if (!cache) return undefined;
    const todayState = queryClient.getQueryData<TodayState>(todayKey(today));
    return offlineTomorrow(cache, today, todayState?.kind === 'outfit' ? todayState.row : null);
  }, [offline, today, queryClient]);
  return { date, state: query.data ?? fallback, status: query.status, offline, refetch: () => void query.refetch() };
}
