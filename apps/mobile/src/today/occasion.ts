import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Formality } from '@tenue/engine';

export const OCCASIONS: Formality[] = ['casual', 'smart', 'formal'];

export function occasionPrefix(userId: string): string {
  return `matin-occasion:${userId}:`;
}

export function occasionKey(userId: string, date: string): string {
  return `${occasionPrefix(userId)}${date}`;
}

async function occasionKeys(userId: string): Promise<string[]> {
  const prefix = occasionPrefix(userId);
  return (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
}

export async function pruneOccasions(userId: string, today: string): Promise<void> {
  const prefix = occasionPrefix(userId);
  const stale = (await occasionKeys(userId)).filter((k) => k.slice(prefix.length) < today);
  if (stale.length > 0) await AsyncStorage.multiRemove(stale);
}

export async function carryOccasion(fromUser: string, toUser: string, today: string): Promise<void> {
  const value = await getOccasion(fromUser, today);
  if (value) await setOccasion(toUser, today, value);
}

export async function getOccasion(userId: string, date: string): Promise<Formality | null> {
  await pruneOccasions(userId, date).catch(() => {});
  const value = await AsyncStorage.getItem(occasionKey(userId, date));
  return OCCASIONS.find((o) => o === value) ?? null;
}

export async function setOccasion(userId: string, date: string, occasion: Formality | null): Promise<void> {
  if (occasion) await AsyncStorage.setItem(occasionKey(userId, date), occasion);
  else await AsyncStorage.removeItem(occasionKey(userId, date));
}
