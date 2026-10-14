import AsyncStorage from '@react-native-async-storage/async-storage';

export function onboardingDoneKey(userId: string): string {
  return `onboarding_done:${userId}`;
}

export async function getOnboardingDone(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(onboardingDoneKey(userId))) === '1';
}

export async function setOnboardingDone(userId: string, done = true): Promise<void> {
  if (done) await AsyncStorage.setItem(onboardingDoneKey(userId), '1');
  else await AsyncStorage.removeItem(onboardingDoneKey(userId));
}
