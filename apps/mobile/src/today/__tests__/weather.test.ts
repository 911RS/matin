import { Platform } from 'react-native';
import type { ProfileRow } from '@tenue/backend';
import { loadWeather } from '../weather';

const PROFILE: ProfileRow = {
  id: 'u1',
  locale: 'en',
  push_time: '07:30:00',
  timezone: 'UTC',
  lat: 48.8566,
  lon: 2.3522,
  expo_push_token: null,
};

const os = Platform.OS;

function setOs(value: string) {
  Object.defineProperty(Platform, 'OS', { value, configurable: true });
}

function fakeFetch() {
  return jest.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }));
}

afterEach(() => setOs(os));

describe('loadWeather', () => {
  it('identifies the app to MET Norway on native', async () => {
    const fetchFn = fakeFetch();
    await loadWeather(fetchFn as unknown as typeof fetch, PROFILE, '2026-10-13');
    expect(fetchFn.mock.calls[0]![1]?.headers).toEqual({ 'User-Agent': expect.stringContaining('Matin') });
  });

  it('sends no User-Agent header from the browser', async () => {
    setOs('web');
    const fetchFn = fakeFetch();
    await loadWeather(fetchFn as unknown as typeof fetch, PROFILE, '2026-10-13');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]![1]?.headers).toBeUndefined();
  });
});
