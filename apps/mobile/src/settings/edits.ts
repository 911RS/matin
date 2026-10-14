import type { QueryClient } from '@tanstack/react-query';
import { localDate } from '@tenue/backend';
import type { TodayState } from '../today/types';
import { locationLabelQueryKey, PROFILE_KEY, todayKey } from '../data/keys';
import type { Coords } from './location';
import { setLocationLabel } from './prefs';
import { saveProfile } from './saveProfile';

export function applyPushTime(queryClient: QueryClient, value: string): void {
  void saveProfile(queryClient, { push_time: value }).catch(() => {});
}

export function applyLocation(
  queryClient: QueryClient,
  userId: string | null,
  coords: Coords,
  name: string,
  now: () => Date,
): void {
  if (userId) {
    queryClient.setQueryData(locationLabelQueryKey(userId), name);
    void setLocationLabel(userId, name).catch(() => {});
  }
  void saveProfile(queryClient, coords)
    .then(() => {
      const tz = queryClient.getQueryData<{ timezone: string }>(PROFILE_KEY)?.timezone ?? 'UTC';
      const key = todayKey(localDate(now(), tz));
      if (queryClient.getQueryData<TodayState>(key)?.kind !== 'outfit') {
        return queryClient.invalidateQueries({ queryKey: key });
      }
    })
    .catch(() => {});
}
