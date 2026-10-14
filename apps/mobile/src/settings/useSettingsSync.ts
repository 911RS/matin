import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileRow } from '@tenue/backend';
import { useTranslation } from 'react-i18next';
import { isCloudAccount, useAppSession } from '../auth/SessionContext';
import { useRepo } from '../data/RepoProvider';
import { notificationsQueryKey, PROFILE_KEY } from '../data/keys';
import { useProfile } from '../data/useProfile';
import { detectLanguage, setLanguage } from '../i18n';
import { asLanguage, currentLanguage, hasExplicitLanguage, resolveLocale } from './language';
import { saveProfile } from './saveProfile';
import { cancelDaily, devicePush, ensureChannel, scheduleDaily } from './notifications';
import { getNotificationsOff, getTokenStamp, setTokenStamp } from './prefs';
import { applyReminder, reminderPlan } from './push';
import { deviceTimezone, syncTimezone } from './timezone';

export function useNotificationsOff(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: () => (userId ? getNotificationsOff(userId) : true),
    enabled: enabled && userId !== null,
    networkMode: 'always',
  });
}

export function useReminderSync(active: boolean): void {
  const repo = useRepo();
  const queryClient = useQueryClient();
  const app = useAppSession();
  const { i18n } = useTranslation();
  const userId = app.session.userId;
  const profile = useProfile(active && userId !== null);
  const off = useNotificationsOff(userId, active);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const token = useRef<string | null>(null);
  token.current = profile.data?.expo_push_token ?? null;
  const [foreground, setForeground] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setForeground((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const ready = active && profile.data !== undefined && off.data !== undefined;
  const plan = reminderPlan(profile.data, {
    account: isCloudAccount(app) ? 'cloud' : 'local',
    enabled: off.data === false,
    projectId: devicePush.projectId,
    remoteSupported: devicePush.remoteSupported,
  });
  const planKey = JSON.stringify(plan);

  useEffect(() => {
    if (!ready) return;
    const next = JSON.parse(planKey) as typeof plan;
    queue.current = queue.current
      .then(() =>
        applyReminder(next, {
          push: devicePush,
          ensureChannel,
          scheduleDaily,
          cancelDaily,
          saveTimezone: async () => {
            await syncTimezone(repo, deviceTimezone());
          },
          claimPushToken: async (value) => {
            await repo.claimPushToken(value);
            token.current = value;
            queryClient.setQueryData<ProfileRow>(PROFILE_KEY, (old) =>
              old ? { ...old, expo_push_token: value } : old,
            );
          },
          get currentToken() {
            return token.current;
          },
          readStamp: getTokenStamp,
          writeStamp: setTokenStamp,
          now: Date.now,
        }),
      )
      .catch(() => {});
  }, [ready, planKey, i18n.language, foreground, repo, queryClient]);
}

export function useLocaleSync(active: boolean): void {
  const queryClient = useQueryClient();
  const { session } = useAppSession();
  const userId = session.userId;
  const profile = useProfile(active && userId !== null);
  const locale = asLanguage(profile.data?.locale);

  useEffect(() => {
    if (!active || !locale || !userId) return;
    let alive = true;
    hasExplicitLanguage(userId)
      .catch(() => true)
      .then((explicit) => {
        if (!alive) return;
        const { apply, write } = resolveLocale({ profileLocale: locale, device: detectLanguage(), explicit });
        if (apply !== currentLanguage()) void setLanguage(apply);
        if (write) void saveProfile(queryClient, { locale: write }).catch(() => {});
      });
    return () => {
      alive = false;
    };
  }, [active, locale, userId, queryClient]);
}
