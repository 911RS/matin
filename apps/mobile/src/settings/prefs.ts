import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOnboardingDone } from '../onboarding/flag';
import { occasionPrefix } from '../today/occasion';
import type { TokenStamp } from './push';

export function notificationsOffKey(userId: string): string {
  return `tenue-notifications-off:${userId}`;
}

export function locationLabelKey(userId: string): string {
  return `tenue-location-label:${userId}`;
}

const PUSH_TOKEN_STAMP_KEY = 'tenue-push-token-stamp';

export async function getTokenStamp(): Promise<TokenStamp | null> {
  const raw = await AsyncStorage.getItem(PUSH_TOKEN_STAMP_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TokenStamp>;
    return typeof value.token === 'string' && typeof value.at === 'number' ? { token: value.token, at: value.at } : null;
  } catch {
    return null;
  }
}

export async function setTokenStamp(stamp: TokenStamp | null): Promise<void> {
  if (stamp) await AsyncStorage.setItem(PUSH_TOKEN_STAMP_KEY, JSON.stringify(stamp));
  else await AsyncStorage.removeItem(PUSH_TOKEN_STAMP_KEY);
}

export async function getNotificationsOff(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(notificationsOffKey(userId))) === '1';
}

export async function setNotificationsOff(userId: string, off: boolean): Promise<void> {
  if (off) await AsyncStorage.setItem(notificationsOffKey(userId), '1');
  else await AsyncStorage.removeItem(notificationsOffKey(userId));
}

export function getLocationLabel(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(locationLabelKey(userId));
}

export async function setLocationLabel(userId: string, label: string | null): Promise<void> {
  if (label) await AsyncStorage.setItem(locationLabelKey(userId), label);
  else await AsyncStorage.removeItem(locationLabelKey(userId));
}

export async function forgetUserPrefs(userId: string): Promise<void> {
  const occasions = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(occasionPrefix(userId)));
  await AsyncStorage.multiRemove([notificationsOffKey(userId), locationLabelKey(userId), ...occasions]);
  await setOnboardingDone(userId, false);
}
