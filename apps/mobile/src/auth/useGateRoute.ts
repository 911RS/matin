import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepo } from '../data/RepoProvider';
import { ITEMS_KEY, onboardingQueryKey } from '../data/keys';
import { getOnboardingDone, setOnboardingDone } from '../onboarding/flag';
import { itemsSignal, nextRoute } from './gate';
import type { GateRoute } from './gate';
import type { SessionState } from './useSession';

export function useGateRoute(session: SessionState): GateRoute | null {
  const repo = useRepo();
  const queryClient = useQueryClient();
  const userId = session.userId;
  const [mountedAt] = useState(() => Date.now());

  const items = useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => repo.listItems(),
    enabled: userId !== null,
  });
  const flag = useQuery({
    queryKey: onboardingQueryKey(userId),
    queryFn: () => (userId ? getOnboardingDone(userId) : false),
    enabled: userId !== null,
    networkMode: 'always',
  });

  const fresh = items.isSuccess && items.dataUpdatedAt >= mountedAt && items.isFetchedAfterMount;
  const unreachable = items.isError || items.fetchStatus === 'paused';
  const signal = itemsSignal(items.data, fresh, unreachable);
  const onboardingDone = flag.data ?? (flag.isError ? false : undefined);

  const [route, setRoute] = useState<GateRoute | null>(null);
  const next = nextRoute(route, { session: session.status, items: signal, onboardingDone });
  if (next !== route) setRoute(next);

  const markOnboarded =
    userId !== null && fresh && signal === 'some' && onboardingDone === false && next !== '/onboarding';

  useEffect(() => {
    if (!markOnboarded || !userId) return;
    setOnboardingDone(userId)
      .then(() => queryClient.setQueryData(onboardingQueryKey(userId), true))
      .catch(() => {});
  }, [markOnboarded, userId, queryClient]);

  return next;
}
