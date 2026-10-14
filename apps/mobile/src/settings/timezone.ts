import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { PROFILE_KEY } from '../data/keys';
import type { Repo } from '../data/repo';
import type { SessionStatus } from '../auth/gate';

export function shouldUpdateTimezone(
  profileTz: string | null | undefined,
  deviceTz: string | null | undefined,
): boolean {
  if (!deviceTz) return false;
  return profileTz !== deviceTz;
}

export function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export async function syncTimezone(repo: Repo, deviceTz: string | undefined): Promise<boolean> {
  const profile = await repo.getProfile();
  if (!shouldUpdateTimezone(profile.timezone, deviceTz) || !deviceTz) return false;
  await repo.updateProfile({ timezone: deviceTz });
  return true;
}

export function useTimezoneSync(repo: Repo | null, session: SessionStatus, userId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!repo || session !== 'signedIn' && session !== 'guest') return;
    let active = true;
    const run = () =>
      syncTimezone(repo, deviceTimezone())
        .then((changed) => {
          if (active && changed) void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
        })
        .catch(() => {});
    void run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [repo, session, userId, queryClient]);
}
