import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOccasion, setOccasion } from '../occasion';

beforeEach(() => AsyncStorage.clear());

describe('occasion storage', () => {
  it('drops keys older than the day being loaded', async () => {
    await setOccasion('u1', '2026-10-10', 'smart');
    await setOccasion('u1', '2026-10-12', 'formal');
    await setOccasion('u2', '2026-10-10', 'smart');
    expect(await getOccasion('u1', '2026-10-12')).toBe('formal');
    expect(await getOccasion('u1', '2026-10-10')).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toHaveLength(2);
  });
});
