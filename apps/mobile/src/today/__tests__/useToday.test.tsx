import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { ItemRow } from '@tenue/backend';
import { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import { registerMutationDefaults } from '../../data/mutations';
import { RepoProvider } from '../../data/RepoProvider';
import { DEMO_USER_ID, LocalRepo } from '../../data/localRepo';
import type { TodayState } from '../types';
import { localDate } from '@tenue/backend';
import type { OutfitRow } from '@tenue/backend';
import { ITEMS_KEY, PROFILE_KEY, todayKey } from '../../data/keys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureToday } from '../flows';
import { occasionKey } from '../occasion';
import { useToday } from '../useToday';

const NOW = new Date('2026-10-12T08:00:00Z');
const DATE = '2026-10-12';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => void map.set(k, v),
    getAllKeys: async () => [...map.keys()],
    multiRemove: async (keys: readonly string[]) => keys.forEach((k) => map.delete(k)),
  };
}

function item(id: string, category: ItemRow['category'], color: ItemRow['color_family']): ItemRow {
  return {
    id,
    user_id: DEMO_USER_ID,
    category,
    color_hex: '#000000',
    color_family: color,
    warmth: 2,
    formality: 'casual',
    image_path: `${id}.webp`,
    original_path: `${id}.jpg`,
    archived_at: null,
    unavailable_until: null,
  };
}

const CLOSET = [
  item('t1', 'top', 'white'),
  item('t2', 'top', 'beige'),
  item('b1', 'bottom', 'navy'),
  item('b2', 'bottom', 'black'),
  item('s1', 'shoes', 'black'),
  item('s2', 'shoes', 'white'),
];

async function setup(opts: { wait?: boolean; fetchFn?: unknown; profileTz?: string; seed?: (repo: LocalRepo) => Promise<void> } = {}) {
  const repo = new LocalRepo({
    userId: DEMO_USER_ID,
    prefix: 'tenue-test:',
    storage: memoryStorage(),
    files: { dir: 'file:///test/', copy: async () => {}, remove: async () => {} },
    defaults: { locale: 'en', timezone: opts.profileTz ?? 'UTC' },
  });
  for (const i of CLOSET) await repo.saveItem(i);
  await opts.seed?.(repo);
  const client = createQueryClient();
  registerMutationDefaults(client, repo, { alwaysOnline: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>{children}</RepoProvider>
    </QueryClientProvider>
  );
  const fetchFn = (opts.fetchFn ?? jest.fn()) as unknown as typeof fetch;
  const hook = await renderHook(() => useToday({ now: () => NOW, fetchFn }), { wrapper });
  if (opts.wait !== false) await waitFor(() => expect(hook.result.current.state?.kind).toBe('outfit'));
  const write = jest.spyOn(repo, 'updateOutfit');
  mounted.push({ unmount: hook.unmount, client });
  return { repo, client, hook, write };
}

async function assumedSeed(r: LocalRepo) {
  await ensureToday({ repo: r, now: () => NOW, fetchFn: jest.fn() as unknown as typeof fetch });
  await r.updateProfile({ lat: 48.86, lon: 2.35 });
}

const mounted: { unmount: () => unknown; client: ReturnType<typeof createQueryClient> }[] = [];

beforeAll(() => initI18n('en'));

afterEach(async () => {
  jest.restoreAllMocks();
  onlineManager.setOnline(true);
  for (const m of mounted.splice(0)) {
    await m.unmount();
    for (const mutation of m.client.getMutationCache().getAll()) mutation.destroy();
    m.client.clear();
  }
});

const outfit = (s: TodayState | undefined) => {
  if (s?.kind !== 'outfit') throw new Error('expected outfit');
  return s;
};

describe('useToday', () => {
  it('reads today under the outfit date key', async () => {
    const { client, hook } = await setup();
    expect(hook.result.current.date).toBe(DATE);
    expect(client.getQueryData(todayKey(DATE))).toEqual(hook.result.current.state);
  });

  it('swap shows the new outfit and writes once through the queued mutation', async () => {
    const { repo, client, hook, write } = await setup();
    const before = outfit(hook.result.current.state);
    const top = before.items.find((i) => i.category === 'top')!;
    await act(async () => hook.result.current.swap('top'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const after = outfit(hook.result.current.state);
    expect(after.items.find((i) => i.category === 'top')!.id).not.toBe(top.id);
    expect(write).toHaveBeenCalledWith(DATE, { item_ids: after.row.item_ids });
    const queued = client.getMutationCache().getAll().filter((m) => m.options.mutationKey);
    expect(queued.map((m) => m.options.mutationKey)).toEqual([['updateOutfit']]);
    await waitFor(async () => expect((await repo.getOutfit(DATE))?.item_ids).toEqual(after.row.item_ids));
  });

  describe('occasion', () => {
    const SMART = async (r: LocalRepo) => {
      for (const [id, c, col] of [['t3', 'top', 'white'], ['b3', 'bottom', 'navy'], ['s3', 'shoes', 'black']] as const) {
        await r.saveItem({ ...item(id, c, col), formality: 'smart' });
      }
    };
    const KEY = occasionKey(DEMO_USER_ID, DATE);

    beforeEach(() => AsyncStorage.clear());

    it('picks for the occasion with the current seed, persists it, and clearing restores the default', async () => {
      const { hook, write } = await setup({ seed: SMART });
      const before = outfit(hook.result.current.state);
      await act(async () => hook.result.current.chooseOccasion('smart'));
      await waitFor(() => expect(hook.result.current.occasion).toBe('smart'));
      const picked = outfit(hook.result.current.state);
      expect(picked.row.seed).toBe(before.row.seed);
      expect(picked.row.item_ids).not.toEqual(before.row.item_ids);
      const smart = (o: ReturnType<typeof outfit>) => o.items.filter((i) => i.formality === 'smart').length;
      expect(smart(picked)).toBeGreaterThan(smart(before));
      expect(write).toHaveBeenLastCalledWith(DATE, { seed: before.row.seed, item_ids: picked.row.item_ids });
      expect(await AsyncStorage.getItem(KEY)).toBe('smart');

      await act(async () => hook.result.current.chooseOccasion('smart'));
      await waitFor(() => expect(hook.result.current.occasion).toBeNull());
      expect(outfit(hook.result.current.state).row.item_ids).toEqual(before.row.item_ids);
      expect(outfit(hook.result.current.state).row.seed).toBe(before.row.seed);
      expect(await AsyncStorage.getItem(KEY)).toBeNull();
    });

    it('reverts the chip and storage when the write fails', async () => {
      const { client, hook, write } = await setup({ seed: SMART });
      client.setMutationDefaults(['updateOutfit'], { ...client.getMutationDefaults(['updateOutfit']), retry: false });
      write.mockRejectedValue(new Error('no'));
      await act(async () => hook.result.current.chooseOccasion('smart'));
      await waitFor(() => expect(write).toHaveBeenCalled());
      await waitFor(() => expect(hook.result.current.occasion).toBeNull());
      expect(await AsyncStorage.getItem(KEY)).toBeNull();
    });

    it('restores the remembered occasion for the day', async () => {
      await AsyncStorage.setItem(KEY, 'formal');
      const { hook } = await setup({ seed: SMART });
      await waitFor(() => expect(hook.result.current.occasion).toBe('formal'));
    });

    it('does nothing once the outfit is worn', async () => {
      const { hook, write } = await setup({ seed: SMART });
      await act(async () => hook.result.current.wear());
      await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
      await act(async () => hook.result.current.chooseOccasion('smart'));
      expect(write).toHaveBeenCalledTimes(1);
      expect(hook.result.current.occasion).toBeNull();
    });
  });

  it('shuffle bumps the seed and writes once', async () => {
    const { client, hook, write } = await setup();
    const before = outfit(hook.result.current.state);
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(outfit(hook.result.current.state).row.seed).toBe(before.row.seed + 1);
    expect(write).toHaveBeenCalledWith(DATE, expect.objectContaining({ seed: before.row.seed + 1 }));
  });

  it('wear marks the outfit worn right away and writes once', async () => {
    const { repo, client, hook, write } = await setup();
    await act(async () => hook.result.current.wear());
    expect(outfit(hook.result.current.state).row.status).toBe('worn');
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const worn = outfit(hook.result.current.state).row;
    expect(write).toHaveBeenCalledWith(DATE, { status: 'worn', item_ids: worn.item_ids, seed: worn.seed });
    await waitFor(async () => expect((await repo.getOutfit(DATE))?.status).toBe('worn'));
  });

  it('drops a weather refresh that lands after unmount', async () => {
    const fixture = jest.requireActual('../../../../../packages/backend/test/fixtures/metno-paris.json');
    let release: (r: Response) => void = () => {};
    const fetchFn = jest.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    const write = jest.spyOn(LocalRepo.prototype, 'updateOutfit');
    const { hook } = await setup({ wait: false, fetchFn, seed: assumedSeed });
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const entry = mounted.pop()!;
    await hook.unmount();
    await act(async () => release(new Response(JSON.stringify(fixture), { status: 200 })));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(write).not.toHaveBeenCalled();
    entry.client.clear();
  });

  it('refreshes an untouched assumed row with real weather through updateOutfit', async () => {
    const fixture = jest.requireActual('../../../../../packages/backend/test/fixtures/metno-paris.json');
    const fetchFn = jest.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    const write = jest.spyOn(LocalRepo.prototype, 'updateOutfit');
    const { repo, client, hook } = await setup({ fetchFn, seed: assumedSeed });
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const call = write.mock.calls[0]!;
    expect(call[0]).toBe(DATE);
    expect(call[1].weather?.assumed).toBeUndefined();
    await waitFor(() => expect(client.isMutating()).toBe(0));
    const shown = outfit(hook.result.current.state).row;
    expect(call[1].item_ids).toEqual(shown.item_ids);
    expect(shown.weather.assumed).toBeUndefined();
    expect(shown.weather).toEqual(call[1].weather);
    expect((await repo.getOutfit(DATE))?.item_ids).toEqual(shown.item_ids);
  });

  describe.each([
    ['shuffle', (api: ReturnType<typeof useToday>) => api.shuffle()],
    ['wear', (api: ReturnType<typeof useToday>) => api.wear()],
  ])('a %s while the weather is loading', (name, act1) => {
    it('drops the refresh and keeps the user change', async () => {
      const fixture = jest.requireActual('../../../../../packages/backend/test/fixtures/metno-paris.json');
      let release: (r: Response) => void = () => {};
      const fetchFn = jest.fn(() => new Promise<Response>((resolve) => (release = resolve)));
      const write = jest.spyOn(LocalRepo.prototype, 'updateOutfit');
      const { repo, client, hook } = await setup({ wait: false, fetchFn, seed: assumedSeed });
      const assumed = (await repo.getOutfit(DATE))!;
      await waitFor(() => expect(fetchFn).toHaveBeenCalled());
      const items = CLOSET.filter((i) => assumed.item_ids.includes(i.id));
      const cached: TodayState = { kind: 'outfit', date: DATE, row: assumed, items };
      client.setQueryData(todayKey(DATE), cached);
      await waitFor(() => expect(hook.result.current.state?.kind).toBe('outfit'));
      await act(async () => act1(hook.result.current));
      await waitFor(() => expect(client.isMutating()).toBe(0));
      await act(async () => release(new Response(JSON.stringify(fixture), { status: 200 })));
      await act(async () => new Promise((r) => setTimeout(r, 50)));
      await waitFor(() => expect(client.isMutating()).toBe(0));
      const stored = (await repo.getOutfit(DATE))!;
      const shown = outfit(hook.result.current.state).row;
      expect(write.mock.calls.every(([, patch]) => patch.weather === undefined)).toBe(true);
      expect(stored.weather.assumed).toBe(true);
      expect(shown.weather.assumed).toBe(true);
      expect(shown.item_ids).toEqual(stored.item_ids);
      expect(shown.seed).toBe(stored.seed);
      if (name === 'wear') expect(stored.status).toBe('worn');
      else expect(stored.seed).toBe(assumed.seed + 1);
    });
  });

  it('keys the day on the profile timezone, like the cron', async () => {
    const tz = 'Pacific/Pago_Pago';
    const cronDate = localDate(NOW, tz);
    expect(cronDate).toBe('2026-10-11');
    const cronRow: OutfitRow = {
      user_id: DEMO_USER_ID,
      date: cronDate,
      item_ids: ['t2', 'b2', 's2'],
      weather: { feelsLikeC: 20, rain: false },
      seed: 7,
      status: 'suggested',
    };
    const { repo, hook } = await setup({ profileTz: tz, seed: async (r) => void (await r.insertOutfit(cronRow)) });
    expect(hook.result.current.date).toBe(cronDate);
    expect(outfit(hook.result.current.state).row.item_ids).toEqual(cronRow.item_ids);
    expect(await repo.getOutfit(DATE)).toBeNull();
  });

  it('shuffles offline from the warm cache and queues the patch', async () => {
    const { repo, client, hook, write } = await setup();
    const before = outfit(hook.result.current.state);
    const offline = (['getProfile', 'listItems', 'listOutfits'] as const).map((m) =>
      jest.spyOn(repo, m).mockRejectedValue(new Error('offline')),
    );
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(outfit(hook.result.current.state).row.seed).toBe(before.row.seed + 1);
    expect(hook.result.current.failed).toBe(false);
    offline.forEach((spy) => spy.mockRestore());
    await waitFor(() => expect(client.isFetching()).toBe(0), { timeout: 5000 });
  });

  it('reports a failed change instead of failing silently', async () => {
    const { client, hook, write } = await setup();
    client.removeQueries({ queryKey: ITEMS_KEY });
    jest.spyOn(client, 'fetchQuery').mockRejectedValue(new Error('offline'));
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(hook.result.current.failed).toBe(true));
    expect(write).not.toHaveBeenCalled();
  });

  it('clears the failure when Wear starts', async () => {
    const { client, hook } = await setup();
    client.removeQueries({ queryKey: ITEMS_KEY });
    const spy = jest.spyOn(client, 'fetchQuery').mockRejectedValue(new Error('offline'));
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(hook.result.current.failed).toBe(true));
    spy.mockRestore();
    await act(async () => hook.result.current.wear());
    expect(hook.result.current.failed).toBe(false);
    expect(outfit(hook.result.current.state).row.status).toBe('worn');
  });

  it('reads fresh data first and falls back to the cache when the read fails', async () => {
    const { repo, client, hook } = await setup();
    const list = jest.spyOn(repo, 'listItems');
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(list).toHaveBeenCalled();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    list.mockClear();
    list.mockRejectedValue(new Error('offline'));
    const before = outfit(hook.result.current.state).row.seed;
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(outfit(hook.result.current.state).row.seed).toBe(before + 1));
    expect(list).toHaveBeenCalled();
    expect(hook.result.current.failed).toBe(false);
    expect(client.getQueryData(ITEMS_KEY)).toHaveLength(CLOSET.length);
  });

  it('drops a result when the outfit changed while it was computing', async () => {
    const { client, hook, write } = await setup();
    const before = outfit(hook.result.current.state);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = client.fetchQuery.bind(client);
    const spy = jest.spyOn(client, 'fetchQuery').mockImplementation(async (o) => {
      await gate;
      return real(o);
    });
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const changed = { ...before, row: { ...before.row, item_ids: [...before.row.item_ids].reverse() } };
    await act(async () => {
      client.setQueryData(todayKey(DATE), changed);
    });
    await act(async () => release());
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(outfit(hook.result.current.state).row.item_ids).toEqual(changed.row.item_ids);
    expect(write).not.toHaveBeenCalled();
  });

  it('ignores a second tap while a change is running', async () => {
    const { hook, write } = await setup();
    const before = outfit(hook.result.current.state);
    await act(async () => {
      hook.result.current.shuffle();
      hook.result.current.shuffle();
      hook.result.current.wear();
    });
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(outfit(hook.result.current.state).row.seed).toBe(before.row.seed + 1);
    expect(outfit(hook.result.current.state).row.status).toBe('suggested');
  });

  it('keeps the stored outfit when a shuffle finds pieces missing', async () => {
    const { repo, hook, write } = await setup();
    const before = outfit(hook.result.current.state);
    for (const i of CLOSET.filter((c) => c.category === 'shoes')) await repo.saveItem({ ...i, archived_at: NOW.toISOString() });
    await act(async () => hook.result.current.shuffle());
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
    expect(hook.result.current.state).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('suggests from the warm cache offline on a new day and queues the insert', async () => {
    const repo = offlineRepo();
    const client = createQueryClient();
    registerMutationDefaults(client, repo);
    client.setQueryData(PROFILE_KEY, await repo.getProfile());
    client.setQueryData(ITEMS_KEY, CLOSET);
    const failing = (['getProfile', 'listItems', 'listOutfits', 'getOutfit', 'insertOutfit'] as const).map((m) =>
      jest.spyOn(repo, m).mockRejectedValue(new Error('offline')),
    );
    onlineManager.setOnline(false);
    const hook = await mount(client, repo);
    await waitFor(() => expect(hook.result.current.state?.kind).toBe('outfit'), { timeout: 5000 });
    const state = outfit(hook.result.current.state);
    expect(state.row.weather.assumed).toBe(true);
    expect(hook.result.current.offline).toBe(false);
    const inserts = client.getMutationCache().findAll({ mutationKey: ['insertOutfit'] });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.state.isPaused).toBe(true);
    expect(inserts[0]!.state.variables).toMatchObject({ date: DATE, item_ids: state.row.item_ids, status: 'suggested' });

    failing.forEach((spy) => spy.mockRestore());
    const insert = jest.spyOn(repo, 'insertOutfit');
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await waitFor(async () => expect((await repo.getOutfit(DATE))?.item_ids).toEqual(state.row.item_ids));
    await waitFor(() => expect(client.isFetching()).toBe(0), { timeout: 5000 });
    expect(outfit(hook.result.current.state).row.item_ids).toEqual(state.row.item_ids);
  }, 20000);

  it('shows the offline state instead of a skeleton when nothing is cached', async () => {
    const repo = offlineRepo();
    const client = createQueryClient();
    registerMutationDefaults(client, repo);
    for (const m of ['getProfile', 'listItems', 'listOutfits', 'getOutfit'] as const) {
      jest.spyOn(repo, m).mockRejectedValue(new Error('offline'));
    }
    onlineManager.setOnline(false);
    const hook = await mount(client, repo);
    await waitFor(() => expect(hook.result.current.offline).toBe(true), { timeout: 5000 });
    expect(hook.result.current.state).toBeUndefined();
    expect(client.getMutationCache().findAll({ mutationKey: ['insertOutfit'] })).toHaveLength(0);
  }, 10000);
});

function offlineRepo() {
  return new LocalRepo({
    userId: DEMO_USER_ID,
    prefix: 'tenue-offline:',
    storage: memoryStorage(),
    files: { dir: 'file:///test/', copy: async () => {}, remove: async () => {} },
    defaults: { locale: 'en', timezone: 'UTC' },
  });
}

async function mount(client: ReturnType<typeof createQueryClient>, repo: LocalRepo) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>{children}</RepoProvider>
    </QueryClientProvider>
  );
  const fetchFn = jest.fn(async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  const hook = await renderHook(() => useToday({ now: () => NOW, fetchFn }), { wrapper });
  mounted.push({ unmount: hook.unmount, client });
  return hook;
}
