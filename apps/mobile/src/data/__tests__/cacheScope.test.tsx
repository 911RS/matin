import AsyncStorage from '@react-native-async-storage/async-storage';
import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { SessionState } from '../../auth/useSession';
import { CACHE_OWNER_KEY, cacheBuster, shouldResetCache, useCacheScope } from '../cacheScope';

const clients: QueryClient[] = [];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const persister = { persistClient: jest.fn(), restoreClient: jest.fn(), removeClient: jest.fn(async () => {}) };
  return { client, persister };
}

function seed(client: QueryClient) {
  client.setQueryData(['items', { includeArchived: false }], [{ id: 'a' }]);
  client.setMutationDefaults(['saveItem'], { mutationFn: async () => {}, networkMode: 'online' });
  onlineManager.setOnline(false);
  void new MutationObserver<void, Error, { id: string }>(client, { mutationKey: ['saveItem'] }).mutate({ id: 'a' }).catch(() => {});
  onlineManager.setOnline(true);
}

const signedIn = (userId: string): SessionState => ({ status: 'signedIn', userId });
const signedOut: SessionState = { status: 'signedOut', userId: null };

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  onlineManager.setOnline(true);
  for (const c of clients.splice(0)) c.clear();
});

describe('shouldResetCache', () => {
  it('resets when the owner changes or is unknown', () => {
    expect(shouldResetCache('a', 'b')).toBe(true);
    expect(shouldResetCache('a', null)).toBe(true);
    expect(shouldResetCache(null, 'a')).toBe(true);
  });

  it('keeps the cache for the same owner', () => {
    expect(shouldResetCache('a', 'a')).toBe(false);
    expect(shouldResetCache(null, null)).toBe(false);
  });
});

describe('cacheBuster', () => {
  it('differs per user', () => {
    expect(cacheBuster('a')).not.toBe(cacheBuster('b'));
    expect(cacheBuster(null)).not.toBe(cacheBuster('a'));
  });
});

describe('useCacheScope', () => {
  it('stays closed while the session is loading', async () => {
    const { client, persister } = setup();
    const { result } = await renderHook(() =>
      useCacheScope(client, { status: 'loading', userId: null }, persister),
    );
    expect(result.current).toBe(false);
    expect(persister.removeClient).not.toHaveBeenCalled();
  });

  it('keeps the cache when the stored owner is the current user', async () => {
    await AsyncStorage.setItem(CACHE_OWNER_KEY, 'u1');
    const { client, persister } = setup();
    seed(client);
    const { result } = await renderHook(() => useCacheScope(client, signedIn('u1'), persister));
    await waitFor(() => expect(result.current).toBe(true));
    expect(persister.removeClient).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    expect(client.getMutationCache().getAll()).toHaveLength(1);
  });

  it('clears everything at startup when a different user owns the stored cache', async () => {
    await AsyncStorage.setItem(CACHE_OWNER_KEY, 'u1');
    const { client, persister } = setup();
    seed(client);
    const { result } = await renderHook(() => useCacheScope(client, signedIn('u2'), persister));
    await waitFor(() => expect(result.current).toBe(true));
    expect(persister.removeClient).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(await AsyncStorage.getItem(CACHE_OWNER_KEY)).toBe('u2');
  });

  it('closes immediately and clears when the user switches, then reopens', async () => {
    await AsyncStorage.setItem(CACHE_OWNER_KEY, 'u1');
    const { client, persister } = setup();
    const renders: { userId: string | null; open: boolean; mutations: number }[] = [];
    const { result, rerender } = await renderHook(
      (s: SessionState) => {
        const open = useCacheScope(client, s, persister);
        renders.push({ userId: s.userId, open, mutations: client.getMutationCache().getAll().length });
        return open;
      },
      { initialProps: signedIn('u1') },
    );
    await waitFor(() => expect(result.current).toBe(true));
    seed(client);

    await rerender(signedIn('u2'));
    await waitFor(() => expect(result.current).toBe(true));
    const forU2 = renders.filter((r) => r.userId === 'u2');
    expect(forU2[0].open).toBe(false);
    expect(forU2.filter((r) => r.open && r.mutations > 0)).toEqual([]);
    expect(persister.removeClient).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(await AsyncStorage.getItem(CACHE_OWNER_KEY)).toBe('u2');
  });

  it('clears on sign-out and forgets the owner', async () => {
    await AsyncStorage.setItem(CACHE_OWNER_KEY, 'u1');
    const { client, persister } = setup();
    const { result, rerender } = await renderHook((s: SessionState) => useCacheScope(client, s, persister), {
      initialProps: signedIn('u1'),
    });
    await waitFor(() => expect(result.current).toBe(true));
    seed(client);
    await rerender(signedOut);
    await waitFor(() => expect(result.current).toBe(true));
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(await AsyncStorage.getItem(CACHE_OWNER_KEY)).toBeNull();
  });

  it('does not wipe the current scope when a superseded switch finishes late', async () => {
    await AsyncStorage.setItem(CACHE_OWNER_KEY, 'u1');
    const { client, persister } = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    persister.removeClient.mockImplementationOnce(async () => gate);
    const { result, rerender } = await renderHook((s: SessionState) => useCacheScope(client, s, persister), {
      initialProps: signedIn('u2'),
    });
    await waitFor(() => expect(persister.removeClient).toHaveBeenCalledTimes(1));
    await rerender(signedIn('u1'));
    await waitFor(() => expect(result.current).toBe(true));
    client.setQueryData(['items', { includeArchived: false }], [{ id: 'a' }]);
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    expect(await AsyncStorage.getItem(CACHE_OWNER_KEY)).toBe('u1');
  });
});
