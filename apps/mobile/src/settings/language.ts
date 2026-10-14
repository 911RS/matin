import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { setLanguage } from '../i18n';
import type { AppLanguage } from '../i18n';

export const DEFAULT_PROFILE_LOCALE: AppLanguage = 'en';

export function explicitLanguageKey(userId: string): string {
  return `tenue-language-explicit:${userId}`;
}

export function asLanguage(value: string | null | undefined): AppLanguage | null {
  return value === 'en' || value === 'fr' ? value : null;
}

export function currentLanguage(): AppLanguage {
  return asLanguage(i18n.language) ?? 'en';
}

export async function hasExplicitLanguage(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(explicitLanguageKey(userId))) === '1';
}

export async function markExplicitLanguage(userId: string): Promise<void> {
  await AsyncStorage.setItem(explicitLanguageKey(userId), '1');
}

export async function chooseLanguage(language: AppLanguage, userId: string | null): Promise<void> {
  if (userId) await markExplicitLanguage(userId).catch(() => {});
  await setLanguage(language);
}

export function resolveLocale(input: {
  profileLocale: AppLanguage;
  device: AppLanguage;
  explicit: boolean;
}): { apply: AppLanguage; write: AppLanguage | null } {
  const { profileLocale, device, explicit } = input;
  if (!explicit && profileLocale === DEFAULT_PROFILE_LOCALE && device !== profileLocale) {
    return { apply: device, write: device };
  }
  return { apply: profileLocale, write: null };
}
