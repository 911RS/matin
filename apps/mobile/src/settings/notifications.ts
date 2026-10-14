import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme';
import type { PermissionState, PushDeps } from './push';

type NotificationsModule = typeof import('expo-notifications');

export const CHANNEL_ID = 'default';
export const DAILY_REMINDER_ID = 'tenue-daily-reminder';

export function notificationsSupported(os: string, environment: string | undefined): boolean {
  if (os === 'web') return false;
  return !(os === 'android' && environment === ExecutionEnvironment.StoreClient);
}

export const remindersNeedNativeApp = Platform.OS === 'web';

let loaded: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (loaded === undefined) {
    loaded = notificationsSupported(Platform.OS, Constants.executionEnvironment)
      ? (require('expo-notifications') as NotificationsModule)
      : null;
  }
  return loaded;
}

const UNSUPPORTED: PermissionState = { granted: false, canAskAgain: false };

export function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === 'string' && id ? id : undefined;
}

export function remotePushSupported(os: string, environment: string | undefined): boolean {
  return notificationsSupported(os, environment) && environment !== ExecutionEnvironment.StoreClient;
}

export const devicePush: PushDeps = {
  getPermissions: async () => (await notifications()?.getPermissionsAsync()) ?? UNSUPPORTED,
  requestPermissions: async () => (await notifications()?.requestPermissionsAsync()) ?? UNSUPPORTED,
  getExpoPushToken: async (projectId) => {
    const module = notifications();
    if (!module) throw new Error('Push notifications are not available in this build');
    return (await module.getExpoPushTokenAsync({ projectId })).data;
  },
  projectId: easProjectId(),
  remoteSupported: remotePushSupported(Platform.OS, Constants.executionEnvironment),
};

export async function ensureChannel(): Promise<void> {
  const module = notifications();
  if (Platform.OS !== 'android' || !module) return;
  await module.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t('settings.channelName'),
    importance: module.AndroidImportance.HIGH,
  });
}

export async function scheduleDaily(hour: number, minute: number): Promise<void> {
  const module = notifications();
  if (!module) return;
  await module.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: { title: i18n.t('settings.reminderTitle'), body: i18n.t('settings.reminderBody'), color: colors.accent },
    trigger: { type: module.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
  });
}

export async function cancelDaily(): Promise<void> {
  await notifications()?.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
}
