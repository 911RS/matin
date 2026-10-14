import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient, SUPABASE_AUTH_OPTIONS } from '../supabase';

describe('createSupabaseClient', () => {
  it('uses the PKCE flow with AsyncStorage session storage', () => {
    const fakeClient = { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } };
    const create = jest.fn(() => fakeClient);
    const client = createSupabaseClient('https://x.supabase.co', 'anon', create as never);
    expect(client).toBe(fakeClient);
    expect(create).toHaveBeenCalledWith('https://x.supabase.co', 'anon', { auth: SUPABASE_AUTH_OPTIONS });
    expect(SUPABASE_AUTH_OPTIONS).toEqual({
      flowType: 'pkce',
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    });
  });

  it('detects the session in the URL only on web', () => {
    const load = (os: string) => {
      let options: { detectSessionInUrl: boolean } | undefined;
      jest.isolateModules(() => {
        const { Platform } = require('react-native') as typeof import('react-native');
        Platform.OS = os as typeof Platform.OS;
        options = (require('../supabase') as typeof import('../supabase')).SUPABASE_AUTH_OPTIONS;
      });
      return options!.detectSessionInUrl;
    };
    expect(load('web')).toBe(true);
    expect(load('ios')).toBe(false);
  });
});
