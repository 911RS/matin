import { getConfig } from '../config';

describe('getConfig', () => {
  it('returns demo when EXPO_PUBLIC_DEMO is 1', () => {
    expect(getConfig({ EXPO_PUBLIC_DEMO: '1' })).toEqual({ mode: 'demo' });
  });

  it('returns supabase with url and key', () => {
    expect(
      getConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual({ mode: 'supabase', url: 'https://x.supabase.co', anonKey: 'k' });
  });

  it('runs as guest with nothing set or only half the keys', () => {
    expect(getConfig({})).toEqual({ mode: 'guest' });
    expect(getConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toEqual({ mode: 'guest' });
  });

  it('lets demo win over supabase', () => {
    expect(
      getConfig({
        EXPO_PUBLIC_DEMO: '1',
        EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k',
      }),
    ).toEqual({ mode: 'demo' });
  });
});
