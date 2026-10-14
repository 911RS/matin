import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getConfig } from '../../config';
import type { AppConfig } from '../../config';
import { getSupabase } from '../../lib/supabase';
import { endGuest, isGuest, startGuest } from '../guest';
import { useSession } from '../useSession';

jest.mock('../../config');
jest.mock('../../lib/supabase');

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void;

function mockSupabase(userId: string | null) {
  let callback: AuthCallback = () => {};
  const unsubscribe = jest.fn();
  jest.mocked(getSupabase).mockReturnValue({
    auth: {
      getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null } }),
      onAuthStateChange: (cb: AuthCallback) => {
        callback = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  } as unknown as ReturnType<typeof getSupabase>);
  return { emit: (id: string | null) => callback('SIGNED_IN', id ? { user: { id } } : null), unsubscribe };
}

function useMode(mode: AppConfig['mode']) {
  jest.mocked(getConfig).mockReturnValue(
    mode === 'supabase' ? { mode, url: 'u', anonKey: 'k' } : ({ mode } as AppConfig),
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useSession', () => {
  it('is a guest immediately when the app is not configured', async () => {
    useMode('guest');
    const { result } = await renderHook(() => useSession());
    expect(result.current).toEqual({ status: 'guest', userId: 'local-user' });
  });

  it('is signed in as the demo user in demo mode', async () => {
    useMode('demo');
    const { result } = await renderHook(() => useSession());
    expect(result.current).toEqual({ status: 'signedIn', userId: 'demo-user' });
  });

  it('is signed out without a session or guest flag', async () => {
    useMode('supabase');
    mockSupabase(null);
    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
  });

  it('is a guest when the flag is set and there is no session', async () => {
    useMode('supabase');
    mockSupabase(null);
    await startGuest();
    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current).toEqual({ status: 'guest', userId: 'local-user' }));
  });

  it('lets a session win over the guest flag and clears it', async () => {
    useMode('supabase');
    mockSupabase('u1');
    await startGuest();
    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current).toEqual({ status: 'signedIn', userId: 'u1' }));
    await waitFor(async () => expect(await AsyncStorage.getItem('tenue-guest')).toBeNull());
  });

  it('follows startGuest and endGuest', async () => {
    useMode('supabase');
    mockSupabase(null);
    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await act(async () => startGuest());
    await waitFor(() => expect(result.current.status).toBe('guest'));
    await act(async () => endGuest());
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
  });

  it('ends guest mode when a session appears, so sign-out goes to sign-in', async () => {
    useMode('supabase');
    const sb = mockSupabase(null);
    await startGuest();
    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('guest'));
    await act(async () => sb.emit('u1'));
    await waitFor(() => expect(result.current).toEqual({ status: 'signedIn', userId: 'u1' }));
    expect(await isGuest()).toBe(false);
    await act(async () => sb.emit(null));
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
  });
});
