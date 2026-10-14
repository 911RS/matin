import AsyncStorage from '@react-native-async-storage/async-storage';

export const GUEST_KEY = 'tenue-guest';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of [...listeners]) l();
}

export function subscribeGuest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function isGuest(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_KEY)) === '1';
}

export async function startGuest(): Promise<void> {
  await AsyncStorage.setItem(GUEST_KEY, '1');
  notify();
}

export async function endGuest(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_KEY);
  notify();
}
