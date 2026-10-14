import { useEffect, useRef, useState } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { localDate } from '@tenue/backend';
import { isCloudAccount, useAppSession } from '../auth/SessionContext';
import { createLocalRepo, LOCAL_USER_ID } from '../data/localRepo';
import { useRepo } from '../data/RepoProvider';
import { onboardingQueryKey } from '../data/keys';
import { getOnboardingDone, setOnboardingDone } from '../onboarding/flag';
import { hasExplicitLanguage, markExplicitLanguage } from '../settings/language';
import { carryOccasion } from '../today/occasion';
import { deviceTimezone } from '../settings/timezone';
import { forgetUserPrefs, getLocationLabel, getNotificationsOff, setLocationLabel, setNotificationsOff } from '../settings/prefs';
import { createProgressStore, hasGuestData, migrateLocalToCloud } from './migrate';
import type { MigrationResult } from './migrate';

export type MigrationStatus = 'idle' | 'running' | 'done' | 'failed';

export interface MigrationState {
  status: MigrationStatus;
  skippedItems: string[];
}

const running = new Set<string>();

export async function carryOverPrefs(
  cloudUser: string,
  result: Pick<MigrationResult, 'copiedLocation' | 'copiedSettings'>,
  now: () => Date = () => new Date(),
): Promise<void> {
  const label = await getLocationLabel(LOCAL_USER_ID);
  if (result.copiedLocation && label) await setLocationLabel(cloudUser, label);
  if (await getNotificationsOff(LOCAL_USER_ID)) await setNotificationsOff(cloudUser, true);
  if (result.copiedSettings && (await hasExplicitLanguage(LOCAL_USER_ID))) await markExplicitLanguage(cloudUser);
  await carryOccasion(LOCAL_USER_ID, cloudUser, localDate(now(), deviceTimezone() ?? 'UTC'));
  await forgetUserPrefs(LOCAL_USER_ID);
}

export async function carryOverOnboarding(cloudUser: string, onDone: () => void): Promise<void> {
  if (!(await getOnboardingDone(LOCAL_USER_ID))) return;
  await setOnboardingDone(cloudUser);
  onDone();
}

export function useGuestMigration(): MigrationState {
  const cloud = useRepo();
  const queryClient = useQueryClient();
  const app = useAppSession();
  const cloudUser = isCloudAccount(app) ? app.session.userId : null;
  const [state, setState] = useState<MigrationState>({ status: 'idle', skippedItems: [] });
  const [attempt, setAttempt] = useState(0);
  const failed = useRef(false);

  useEffect(
    () =>
      onlineManager.subscribe((online) => {
        if (online && failed.current) setAttempt((n) => n + 1);
      }),
    [],
  );

  useEffect(() => {
    if (!cloudUser || running.has(cloudUser)) return;
    let alive = true;
    const set = (next: MigrationState) => {
      if (alive) setState(next);
    };
    const local = createLocalRepo({ kind: 'guest' });
    running.add(cloudUser);
    failed.current = false;
    (async () => {
      await carryOverOnboarding(cloudUser, () => queryClient.setQueryData(onboardingQueryKey(cloudUser), true));
      if (!(await hasGuestData(local))) return;
      set({ status: 'running', skippedItems: [] });
      const result = await migrateLocalToCloud(local, cloud, createProgressStore(cloudUser));
      await carryOverPrefs(cloudUser, result).catch(() => {});
      await queryClient.invalidateQueries();
      set({ status: 'done', skippedItems: result.skippedItems });
    })()
      .catch(() => {
        failed.current = true;
        set({ status: 'failed', skippedItems: [] });
      })
      .finally(() => running.delete(cloudUser));
    return () => {
      alive = false;
    };
  }, [cloudUser, cloud, queryClient, attempt]);

  return state;
}
