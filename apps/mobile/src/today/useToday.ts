import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Category, Formality } from '@tenue/engine';
import { localDate } from '@tenue/backend';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { useTranslation } from 'react-i18next';
import { HISTORY_KEY, historyKey, ITEMS_KEY, PROFILE_KEY, todayKey } from '../data/keys';
import { enqueue } from '../data/mutations';
import type { UpdateOutfitVars } from '../data/mutations';
import type { Repo } from '../data/repo';
import { useRepo } from '../data/RepoProvider';
import { useProfile } from '../data/useProfile';
import { deviceTimezone } from '../settings/timezone';
import { msUntilNextDay } from './day';
import { ensureToday, markWorn, offlineToday, pickOccasion, shuffle as shuffleFlow, swap as swapFlow } from './flows';
import type { CachedReads, FlowDeps, FlowReads, FlowResult, OutfitState } from './flows';
import { getOccasion, setOccasion } from './occasion';
import type { TodayState } from './types';

export interface TodayOptions {
  now?: () => Date;
  fetchFn?: typeof fetch;
  timezone?: string;
}

export interface TodayApi {
  date: string;
  state: TodayState | undefined;
  status: 'pending' | 'error' | 'success';
  offline: boolean;
  occasion: Formality | null;
  busy: boolean;
  failed: boolean;
  refetch: () => void;
  shuffle: () => void;
  swap: (slot: Category) => void;
  chooseOccasion: (occasion: Formality) => void;
  wear: () => void;
}

type Basis = Pick<OutfitState['row'], 'seed' | 'item_ids' | 'status'>;

const systemNow = () => new Date();
const SHOWN_LIMIT = 3;

function sameBasis(state: TodayState | undefined, basis: Basis): boolean {
  if (state?.kind !== 'outfit') return false;
  const { seed, item_ids, status } = state.row;
  return (
    seed === basis.seed &&
    status === basis.status &&
    item_ids.length === basis.item_ids.length &&
    item_ids.every((id, i) => id === basis.item_ids[i])
  );
}

export function flowReads(queryClient: QueryClient, repo: Repo): FlowReads {
  const load = async <T>(queryKey: QueryKey, queryFn: () => Promise<T>): Promise<T> => {
    const cached = queryClient.getQueryData<T>(queryKey);
    if (!onlineManager.isOnline() || queryClient.getQueryState(queryKey)?.fetchStatus === 'paused') {
      return cached !== undefined ? cached : queryFn();
    }
    try {
      return await queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0 });
    } catch (e) {
      const fallback = queryClient.getQueryData<T>(queryKey) ?? cached;
      if (fallback !== undefined) return fallback;
      throw e;
    }
  };
  return {
    getProfile: () => load(PROFILE_KEY, () => repo.getProfile()),
    listItems: () => load(ITEMS_KEY, () => repo.listItems()),
    listOutfits: (from, to) => load(historyKey(from, to), () => repo.listOutfits(from, to)),
  };
}

export function cachedReads(queryClient: QueryClient): CachedReads | null {
  const profile = queryClient.getQueryData<CachedReads['profile']>(PROFILE_KEY);
  const items = queryClient.getQueryData<ItemRow[]>(ITEMS_KEY);
  if (!profile || !items || items.length === 0) return null;
  const byDate = new Map<string, OutfitRow>();
  for (const [, rows] of queryClient.getQueriesData<OutfitRow[]>({ queryKey: HISTORY_KEY })) {
    for (const row of rows ?? []) byDate.set(row.date, row);
  }
  return { profile, items, recent: [...byDate.values()] };
}

function pendingInsert(queryClient: QueryClient, date: string): boolean {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: ['insertOutfit'], status: 'pending' })
    .some((m) => (m.state.variables as OutfitRow | undefined)?.date === date);
}

export function useDayKey(now: () => Date, timezone: string): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setTick((t) => t + 1), msUntilNextDay(now(), timezone) + 1000);
    return () => clearTimeout(timer);
  }, [now, timezone, tick]);
  return useMemo(() => localDate(now(), timezone), [now, timezone, tick]);
}

export function useProfileTimezone(override?: string): { timezone: string; ready: boolean; paused: boolean } {
  const profile = useProfile(!override);
  return {
    timezone: override ?? profile.data?.timezone ?? deviceTimezone() ?? 'UTC',
    ready: Boolean(override) || profile.data !== undefined || profile.isError,
    paused: !override && profile.data === undefined && profile.fetchStatus === 'paused',
  };
}

export function useToday(options: TodayOptions = {}): TodayApi {
  const { t } = useTranslation();
  const repo = useRepo();
  const queryClient = useQueryClient();
  const now = options.now ?? systemNow;
  const fetchFn = options.fetchFn ?? fetch;
  const { timezone, ready, paused: profilePaused } = useProfileTimezone(options.timezone);
  const date = useDayKey(now, timezone);
  const refreshed = useRef(new Set<string>());
  const refresh = useRef<(result: FlowResult) => void>(() => {});
  const deps = useMemo<FlowDeps>(
    () => ({
      repo,
      now,
      fetchFn,
      reads: flowReads(queryClient, repo),
      refreshed: refreshed.current,
      onRefresh: (result) => refresh.current(result),
    }),
    [repo, now, fetchFn, queryClient],
  );

  const query = useQuery({
    queryKey: todayKey(date),
    queryFn: async () => {
      const current = queryClient.getQueryData<TodayState>(todayKey(date));
      if (current && pendingInsert(queryClient, date)) return current;
      return ensureToday(deps, date);
    },
    enabled: ready,
  });
  const [chosen, setChosen] = useState<{ date: string; occasion: Formality | null }>({ date: '', occasion: null });
  const userId = query.data?.kind === 'outfit' ? query.data.row.user_id : null;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    getOccasion(userId, date)
      .then((stored) => live && setChosen((c) => (c.date === date && c.occasion ? c : { date, occasion: stored })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId, date]);
  const occasion = chosen.date === date ? chosen.occasion : null;
  const occasionRef = useRef<Formality | null>(null);
  occasionRef.current = occasion;
  const inFlight = useRef(false);
  const shown = useRef<{ date: string; sets: string[][] }>({ date: '', sets: [] });

  const paused = query.fetchStatus === 'paused' || (!ready && profilePaused);
  const offline = query.data === undefined && (paused || (query.isError && !onlineManager.isOnline()));

  useEffect(() => {
    if (!offline) return;
    const cache = cachedReads(queryClient);
    if (!cache || queryClient.getQueryData(todayKey(date))) return;
    const local = offlineToday(cache, date);
    queryClient.setQueryData<TodayState>(todayKey(date), local.state);
    if (local.insert) enqueue<OutfitRow>(queryClient, 'insertOutfit', local.insert);
  }, [offline, date, queryClient]);

  const seen = (day: string): string[][] => (shown.current.date === day ? shown.current.sets : []);

  const apply = useCallback(
    async ({ state, patch }: FlowResult, basis: Basis, onError?: (error: unknown) => void): Promise<boolean> => {
      if (!patch || state.kind !== 'outfit') return false;
      const key = todayKey(state.date);
      await queryClient.cancelQueries({ queryKey: key });
      if (!sameBasis(queryClient.getQueryData<TodayState>(key), basis)) return false;
      queryClient.setQueryData<TodayState>(key, state);
      enqueue<UpdateOutfitVars>(queryClient, 'updateOutfit', { date: state.date, patch }, onError);
      return true;
    },
    [queryClient],
  );

  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const unmounted = useRef(false);
  useEffect(() => {
    const pending = timers.current;
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  refresh.current = (result) => {
    if (unmounted.current || result.state.kind !== 'outfit') return;
    const { seed, item_ids, status } = result.state.row;
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      void apply(result, { seed, item_ids, status });
    }, 0);
    timers.current.add(timer);
  };

  const current = (): OutfitState | null => {
    const state = queryClient.getQueryData<TodayState>(todayKey(date));
    return state?.kind === 'outfit' && state.row.status !== 'worn' ? state : null;
  };

  const change = useMutation({
    networkMode: 'always',
    mutationFn: async (run: (state: OutfitState) => Promise<FlowResult>) => {
      const state = current();
      if (!state) return;
      const { seed, item_ids, status } = state.row;
      if (await apply(await run(state), { seed, item_ids, status })) {
        shown.current = { date: state.date, sets: [...seen(state.date), item_ids].slice(-SHOWN_LIMIT) };
      }
    },
    onError: () => AccessibilityInfo.announceForAccessibility(t('common.error')),
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const start = (run: (state: OutfitState) => Promise<FlowResult>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    change.mutate(run);
  };

  return {
    date,
    state: query.data,
    occasion,
    status: query.status,
    offline,
    busy: change.isPending,
    failed: change.isError,
    refetch: () => void query.refetch(),
    shuffle: () => start((state) => shuffleFlow(deps, state, seen(state.date), occasionRef.current)),
    swap: (slot) => start((state) => swapFlow(deps, state, slot, occasionRef.current)),
    chooseOccasion: (picked) => {
      const next = occasionRef.current === picked ? null : picked;
      start(async (state) => {
        const flow = await pickOccasion(deps, state, next);
        const { seed, item_ids, status } = state.row;
        const previous = occasionRef.current;
        let failed = false;
        const revert = () => {
          failed = true;
          setChosen((c) => (c.date === state.date && c.occasion === next ? { date: state.date, occasion: previous } : c));
          void setOccasion(state.row.user_id, state.date, previous).catch(() => {});
        };
        if (!flow.patch || !(await apply(flow, { seed, item_ids, status }, revert))) return { state, patch: null };
        if (failed) return { state, patch: null };
        setChosen({ date: state.date, occasion: next });
        await setOccasion(state.row.user_id, state.date, next).catch(() => {});
        return { state, patch: null };
      });
    },
    wear: () => {
      const state = current();
      if (!state || inFlight.current) return;
      change.reset();
      const { seed, item_ids, status } = state.row;
      void apply(markWorn(state), { seed, item_ids, status });
    },
  };
}
