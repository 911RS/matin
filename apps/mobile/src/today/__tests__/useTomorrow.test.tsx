import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { ItemRow } from '@tenue/backend';
import { createQueryClient } from '../../query';
import { RepoProvider } from '../../data/RepoProvider';
import { DEMO_USER_ID, LocalRepo } from '../../data/localRepo';
import { ITEMS_KEY, PROFILE_KEY, tomorrowKey, weatherKey } from '../../data/keys';
import { useTomorrow } from '../useTomorrow';
import fixture from '../../../../../packages/backend/test/fixtures/metno-paris.json';

const NOW = new Date('2026-10-12T08:00:00Z');
const shifted = JSON.stringify(fixture).replace(/2026-10-13T/g, '2026-10-14T').replace(/2026-10-12T/g, '2026-10-13T');

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => void map.set(k, v),
    getAllKeys: async () => [...map.keys()],
    multiRemove: async (keys: readonly string[]) => keys.forEach((k) => map.delete(k)),
  };
}

function item(id: string, category: ItemRow['category']): ItemRow {
  return {
    id,
    user_id: DEMO_USER_ID,
    category,
    color_hex: '#000000',
    color_family: 'black',
    warmth: 2,
    formality: 'casual',
    image_path: `${id}.webp`,
    original_path: `${id}.jpg`,
    archived_at: null,
    unavailable_until: null,
  };
}

const mounted: { unmount: () => unknown; client: ReturnType<typeof createQueryClient> }[] = [];

afterEach(async () => {
  onlineManager.setOnline(true);
  for (const m of mounted.splice(0)) {
    await m.unmount();
    m.client.clear();
  }
});

async function setup(enabled: boolean, offline = false) {
  const repo = new LocalRepo({
    userId: DEMO_USER_ID,
    prefix: 'tenue-test:',
    storage: memoryStorage(),
    files: { dir: 'file:///test/', copy: async () => {}, remove: async () => {} },
    defaults: { locale: 'en', timezone: 'Europe/Paris' },
  });
  await repo.updateProfile({ lat: 48.86, lon: 2.35 });
  for (const i of [item('t1', 'top'), item('b1', 'bottom'), item('s1', 'shoes')]) await repo.saveItem(i);
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>{children}</RepoProvider>
    </QueryClientProvider>
  );
  if (offline) {
    client.setQueryData(PROFILE_KEY, await repo.getProfile());
    client.setQueryData(ITEMS_KEY, await repo.listItems());
    onlineManager.setOnline(false);
    for (const read of ['getProfile', 'listItems', 'listOutfits'] as const) {
      jest.spyOn(repo, read).mockRejectedValue(new Error('offline'));
    }
  }
  const fetchFn = jest.fn(async () => new Response(shifted, { status: 200 }));
  const hook = await renderHook(() => useTomorrow('2026-10-12', enabled, () => NOW, fetchFn as unknown as typeof fetch), {
    wrapper,
  });
  mounted.push({ unmount: hook.unmount, client });
  return { repo, client, hook, fetchFn };
}

describe('useTomorrow', () => {
  it('does nothing until enabled', async () => {
    const { hook, fetchFn } = await setup(false);
    expect(hook.result.current.state).toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('caches the forecast under the weather key and never writes outfits', async () => {
    const { repo, client, hook } = await setup(true);
    const insert = jest.spyOn(repo, 'insertOutfit');
    await waitFor(() => expect(hook.result.current.state?.kind).toBe('outfit'));
    expect(hook.result.current.date).toBe('2026-10-13');
    expect(client.getQueryData(tomorrowKey('2026-10-13'))).toEqual(hook.result.current.state);
    expect(client.getQueryData(weatherKey(48.86, 2.35, '2026-10-13'))).toMatchObject({ rain: expect.any(Boolean) });
    expect(insert).not.toHaveBeenCalled();
    expect(await repo.getOutfit('2026-10-13')).toBeNull();
  });

  it('falls back to the cached reads when offline', async () => {
    const { hook, fetchFn } = await setup(true, true);
    await waitFor(() => expect(hook.result.current.offline).toBe(true), { timeout: 4000 });
    expect(hook.result.current.state?.kind).toBe('outfit');
    expect(hook.result.current.state?.date).toBe('2026-10-13');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports offline with no state when nothing is cached', async () => {
    const { hook, client } = await setup(true, true);
    client.removeQueries({ queryKey: PROFILE_KEY });
    client.removeQueries({ queryKey: ITEMS_KEY });
    await hook.rerender({});
    await waitFor(() => expect(hook.result.current.offline).toBe(true), { timeout: 4000 });
    expect(hook.result.current.state).toBeUndefined();
  });
});
