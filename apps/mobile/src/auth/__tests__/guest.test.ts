import AsyncStorage from '@react-native-async-storage/async-storage';
import { endGuest, isGuest, startGuest, subscribeGuest } from '../guest';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('guest flag', () => {
  it('is off by default', async () => {
    expect(await isGuest()).toBe(false);
  });

  it('round-trips through storage', async () => {
    await startGuest();
    expect(await AsyncStorage.getItem('tenue-guest')).toBe('1');
    expect(await isGuest()).toBe(true);
    await endGuest();
    expect(await AsyncStorage.getItem('tenue-guest')).toBeNull();
    expect(await isGuest()).toBe(false);
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const listener = jest.fn();
    const off = subscribeGuest(listener);
    await startGuest();
    await endGuest();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    await startGuest();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
