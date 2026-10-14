import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { ItemRow } from '@tenue/backend';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import { ITEMS_KEY, onboardingQueryKey } from '../../data/keys';
import type { SessionState } from '../useSession';
import { useGateRoute } from '../useGateRoute';

const clients: QueryClient[] = [];
const user: SessionState = { status: 'signedIn', userId: 'u1' };
const item = { id: 'a', archived_at: null } as ItemRow;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(listItems: () => Promise<ItemRow[]>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const repo = { listItems: jest.fn(listItems) } as unknown as Repo;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>{children}</RepoProvider>
    </QueryClientProvider>
  );
  return { client, repo, wrapper };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  for (const c of clients.splice(0)) c.clear();
});

describe('useGateRoute', () => {
  it('sends a signed-out user to sign-in', async () => {
    const { wrapper } = setup(async () => []);
    const { result } = await renderHook(() => useGateRoute({ status: 'signedOut', userId: null }), {
      wrapper,
    });
    expect(result.current).toBe('/sign-in');
  });

  it('waits for the fresh list before routing a stale empty cache to onboarding', async () => {
    const fetch = deferred<ItemRow[]>();
    const { client, wrapper } = setup(() => fetch.promise);
    client.setQueryData(ITEMS_KEY, [], { updatedAt: 1 });
    const { result } = await renderHook(() => useGateRoute(user), { wrapper });
    await act(async () => {});
    expect(result.current).toBeNull();
    await act(async () => fetch.resolve([]));
    await waitFor(() => expect(result.current).toBe('/onboarding'));
  });

  it('opens the tabs when a stale empty cache turns out to have items', async () => {
    const fetch = deferred<ItemRow[]>();
    const { client, wrapper } = setup(() => fetch.promise);
    client.setQueryData(ITEMS_KEY, [], { updatedAt: 1 });
    const { result } = await renderHook(() => useGateRoute(user), { wrapper });
    await act(async () => fetch.resolve([item]));
    await waitFor(() => expect(result.current).toBe('/(tabs)'));
    await waitFor(async () => expect(await AsyncStorage.getItem('onboarding_done:u1')).toBe('1'));
  });

  it('marks an existing user on a new device as onboarded', async () => {
    const { client, wrapper } = setup(async () => [item]);
    const { result } = await renderHook(() => useGateRoute(user), { wrapper });
    await waitFor(() => expect(result.current).toBe('/(tabs)'));
    await waitFor(async () => expect(await AsyncStorage.getItem('onboarding_done:u1')).toBe('1'));
    expect(client.getQueryData(onboardingQueryKey('u1'))).toBe(true);
  });

  it('keeps onboarding open after the first item until the flag is set', async () => {
    const { client, wrapper } = setup(async () => []);
    const { result } = await renderHook(() => useGateRoute(user), { wrapper });
    await waitFor(() => expect(result.current).toBe('/onboarding'));

    await act(async () => {
      client.setQueryData(ITEMS_KEY, [item]);
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current).toBe('/onboarding');
    expect(await AsyncStorage.getItem('onboarding_done:u1')).toBeNull();

    await act(async () => {
      client.setQueryData(onboardingQueryKey('u1'), true);
    });
    await waitFor(() => expect(result.current).toBe('/(tabs)'));
  });

  it('reads the flag per user', async () => {
    await AsyncStorage.setItem('onboarding_done:u2', '1');
    const { wrapper } = setup(async () => []);
    const { result } = await renderHook(() => useGateRoute(user), { wrapper });
    await waitFor(() => expect(result.current).toBe('/onboarding'));
  });

  it('opens the tabs for a user whose flag is set even with no items', async () => {
    await AsyncStorage.setItem('onboarding_done:u1', '1');
    const { wrapper } = setup(async () => []);
    const { result } = await renderHook(() => useGateRoute(user), { wrapper });
    await waitFor(() => expect(result.current).toBe('/(tabs)'));
  });

  it('routes a guest to onboarding when the closet is empty', async () => {
    const { wrapper } = setup(async () => []);
    const { result } = await renderHook(
      () => useGateRoute({ status: 'guest', userId: 'local-user' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe('/onboarding'));
  });
});
