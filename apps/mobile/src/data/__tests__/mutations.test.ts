import { MutationObserver, onlineManager } from '@tanstack/react-query';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { createQueryClient } from '../../query';
import type { TodayState } from '../../today/types';
import { wearStatsKey } from '../keys';
import { registerMutationDefaults } from '../mutations';
import type { OutfitPatch, Repo } from '../repo';

const clients: ReturnType<typeof createQueryClient>[] = [];

function newClient() {
  const created = createQueryClient();
  clients.push(created);
  return created;
}

afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.clear();
});

type OutfitVars = { date: string; patch: OutfitPatch };
const outfitObserver = (client: ReturnType<typeof createQueryClient>) =>
  new MutationObserver<void, Error, OutfitVars>(client, { mutationKey: ['updateOutfit'] });
const itemObserver = (client: ReturnType<typeof createQueryClient>) =>
  new MutationObserver<void, Error, ItemRow>(client, { mutationKey: ['saveItem'] });

function item(id: string, archived_at: string | null = null): ItemRow {
  return { id, archived_at } as ItemRow;
}

describe('wear stats invalidation', () => {
  it('invalidates only when the patch changes status or an outfit is inserted', async () => {
    const repo = {
      updateOutfit: jest.fn().mockResolvedValue(undefined),
      insertOutfit: jest.fn().mockResolvedValue('inserted'),
    } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    client.setQueryData(wearStatsKey('2025-10-12', '2026-10-12'), []);
    const state = () => client.getQueryState(wearStatsKey('2025-10-12', '2026-10-12'))!.isInvalidated;

    await outfitObserver(client).mutate({ date: '2026-10-12', patch: { seed: 4 } });
    expect(state()).toBe(false);
    await outfitObserver(client).mutate({ date: '2026-10-12', patch: { status: 'worn' } });
    expect(state()).toBe(true);

    client.setQueryData(wearStatsKey('2025-10-12', '2026-10-12'), []);
    expect(state()).toBe(false);
    await new MutationObserver<unknown, Error, OutfitRow>(client, { mutationKey: ['insertOutfit'] }).mutate({
      date: '2026-10-12',
    } as OutfitRow);
    expect(state()).toBe(true);
  });
});

describe('registerMutationDefaults', () => {
  it('pauses updateOutfit offline and runs it once after resume', async () => {
    const repo = { updateOutfit: jest.fn().mockResolvedValue(undefined) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);

    onlineManager.setOnline(false);
    const pending = outfitObserver(client).mutate({ date: '2026-10-12', patch: { status: 'worn' } });

    await Promise.resolve();
    expect(repo.updateOutfit).not.toHaveBeenCalled();
    expect(client.getMutationCache().getAll()[0].state.isPaused).toBe(true);

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await pending;
    expect(repo.updateOutfit).toHaveBeenCalledTimes(1);
    expect(repo.updateOutfit).toHaveBeenCalledWith('2026-10-12', { status: 'worn' });
  });

  it('replays queued writes in order', async () => {
    const order: number[] = [];
    const repo = {
      updateOutfit: jest.fn(async (_d: string, p: OutfitPatch) => {
        order.push(p.seed as number);
      }),
    } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    onlineManager.setOnline(false);
    const a = outfitObserver(client).mutate({ date: 'd', patch: { seed: 1 } });
    const b = outfitObserver(client).mutate({ date: 'd', patch: { seed: 2 } });
    await Promise.resolve();
    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });

  it('patches the outfit row inside a TodayState and rolls back on error', async () => {
    const repo = { updateOutfit: jest.fn().mockRejectedValue(new Error('no')) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    client.setMutationDefaults(['updateOutfit'], { ...client.getMutationDefaults(['updateOutfit']), retry: false });
    const state: TodayState = {
      kind: 'outfit',
      date: 'd',
      row: { seed: 1, status: 'suggested' } as OutfitRow,
      items: [],
    };
    client.setQueryData(['outfit', 'd'], state);
    await expect(outfitObserver(client).mutate({ date: 'd', patch: { status: 'worn' } })).rejects.toThrow();
    expect(client.getQueryData(['outfit', 'd'])).toEqual(state);
  });

  it('applies the optimistic outfit patch and leaves missing states alone', async () => {
    let release!: () => void;
    const repo = {
      updateOutfit: jest.fn(() => new Promise<void>((r) => (release = r))),
    } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    const state: TodayState = {
      kind: 'outfit',
      date: 'd',
      row: { seed: 1, status: 'suggested' } as OutfitRow,
      items: [],
    };
    client.setQueryData(['outfit', 'd'], state);
    client.setQueryData(['outfit', 'm'], { kind: 'missing', date: 'm', missing: ['top'] });
    const p = outfitObserver(client).mutate({ date: 'd', patch: { status: 'worn' } });
    await new Promise((r) => setTimeout(r, 0));
    expect((client.getQueryData(['outfit', 'd']) as Extract<TodayState, { kind: 'outfit' }>).row.status).toBe('worn');
    release();
    await p;
    const q = outfitObserver(client).mutate({ date: 'm', patch: { status: 'worn' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(client.getQueryData(['outfit', 'm'])).toEqual({ kind: 'missing', date: 'm', missing: ['top'] });
    release();
    await q;
  });

  it('patches the day in cached history lists and refreshes them after the write', async () => {
    const repo = { updateOutfit: jest.fn().mockResolvedValue(undefined) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    const rows = [
      { date: '2026-10-11', status: 'worn', item_ids: ['a'] },
      { date: '2026-10-12', status: 'suggested', item_ids: ['b'] },
    ] as OutfitRow[];
    client.setQueryData(['outfits', '2026-10-01', '2026-10-31'], rows);
    client.setQueryData(['outfits', '2026-09-01', '2026-09-30'], []);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const p = outfitObserver(client).mutate({ date: '2026-10-12', patch: { status: 'worn' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(client.getQueryData<OutfitRow[]>(['outfits', '2026-10-01', '2026-10-31'])?.map((r) => r.status)).toEqual(['worn', 'worn']);
    expect(client.getQueryData(['outfits', '2026-09-01', '2026-09-30'])).toEqual([]);
    await p;
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['outfits'] });
  });

  it('refreshes outfits after a closet change', async () => {
    const repo = { saveItem: jest.fn().mockResolvedValue(undefined) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await itemObserver(client).mutate(item('n'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['outfit'] });
  });

  it('refreshes the outfit only after the last queued outfit write', async () => {
    const order: string[] = [];
    const repo = {
      updateOutfit: jest.fn(async (_d: string, p: OutfitPatch) => {
        order.push(`write ${p.seed}`);
      }),
    } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    const invalidate = jest.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      order.push(`invalidate ${JSON.stringify(filters?.queryKey)}`);
    });
    onlineManager.setOnline(false);
    const a = outfitObserver(client).mutate({ date: 'd', patch: { seed: 1 } });
    const b = outfitObserver(client).mutate({ date: 'd', patch: { seed: 2 } });
    await Promise.resolve();
    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await Promise.all([a, b]);
    expect(order).toEqual(['write 1', 'write 2', 'invalidate ["outfit","d"]', 'invalidate ["outfits"]']);
    invalidate.mockRestore();
  });

  it('removes archived items from active lists only', async () => {
    const repo = { saveItem: jest.fn().mockResolvedValue(undefined) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    client.setQueryData(['items', { includeArchived: false }], [item('a'), item('b')]);
    client.setQueryData(['items', { includeArchived: true }], [item('a'), item('b')]);
    const archived = item('a', '2026-10-01T00:00:00Z');
    const p = itemObserver(client).mutate(archived);
    await new Promise((r) => setTimeout(r, 0));
    expect(client.getQueryData(['items', { includeArchived: false }])).toEqual([item('b')]);
    expect(client.getQueryData(['items', { includeArchived: true }])).toEqual([archived, item('b')]);
    await p;
    expect(repo.saveItem).toHaveBeenCalledWith(archived);
  });

  it('adds new items to both lists and rolls back saveItem on error', async () => {
    const repo = { saveItem: jest.fn().mockRejectedValue(new Error('no')) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo);
    client.setMutationDefaults(['saveItem'], { ...client.getMutationDefaults(['saveItem']), retry: false });
    client.setQueryData(['items', { includeArchived: false }], [item('a')]);
    await expect(itemObserver(client).mutate(item('n'))).rejects.toThrow();
    expect(client.getQueryData(['items', { includeArchived: false }])).toEqual([item('a')]);
  });

  it('runs offline when alwaysOnline is set', async () => {
    const repo = { updateProfile: jest.fn().mockResolvedValue(undefined) } as unknown as Repo;
    const client = newClient();
    registerMutationDefaults(client, repo, { alwaysOnline: true });
    onlineManager.setOnline(false);
    await new MutationObserver<void, Error, { lat: number }>(client, { mutationKey: ['updateProfile'] }).mutate({ lat: 1 });
    expect(repo.updateProfile).toHaveBeenCalledWith({ lat: 1 });
  });

  it('uploads a restored paused image from the pending file derived from its path', async () => {
    const repo = { uploadImage: jest.fn().mockResolvedValue(undefined) } as unknown as Repo;
    const pending = { uriFor: async (p: string) => `file:///pending/${p.replace('/', '~')}`, remove: jest.fn() };
    const client = newClient();
    registerMutationDefaults(client, repo, { pending });

    onlineManager.setOnline(false);
    const stored = { path: 'u1/item.webp', contentType: 'image/webp' } as const;
    const run = new MutationObserver<void, Error, typeof stored>(client, { mutationKey: ['uploadImage'] }).mutate(
      stored,
    );
    await Promise.resolve();
    const [mutation] = client.getMutationCache().getAll();
    expect(mutation.state.isPaused).toBe(true);
    expect(mutation.state.variables).toEqual(stored);
    expect(JSON.stringify(mutation.state.variables)).not.toContain('file://');

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await run;
    expect(repo.uploadImage).toHaveBeenCalledWith('file:///pending/u1~item.webp', 'u1/item.webp', 'image/webp');
    expect(pending.remove).toHaveBeenCalledWith('u1/item.webp');
  });
});
