import type { OutfitRow } from '@tenue/backend';
import { SupabaseRepo } from '../supabaseRepo';

function outfitRow(): OutfitRow {
  return {
    user_id: 'u',
    date: '2026-10-12',
    item_ids: ['a'],
    weather: { feelsLikeC: 10, rain: true },
    seed: 1,
    status: 'suggested',
    pushed_at: '2026-10-12T07:00:00Z',
  };
}

function fakeClient(over: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const insert = jest.fn().mockResolvedValue({ error: null });
  const createSignedUrl = jest.fn(async () => ({ data: { signedUrl: `https://s/${calls.length}` }, error: null }));
  const client = {
    from: jest.fn(() => ({ insert })),
    storage: { from: jest.fn(() => ({ createSignedUrl })) },
    functions: {
      invoke: jest.fn(async () => {
        calls.push('invoke');
        return { error: null };
      }),
    },
    auth: {
      signOut: jest.fn(async () => {
        calls.push('signOut');
        return { error: null };
      }),
    },
    ...over,
  };
  return { client, calls, insert, createSignedUrl };
}

describe('SupabaseRepo', () => {
  it('maps 23505 to conflict and rethrows other errors', async () => {
    const f = fakeClient();
    const repo = new SupabaseRepo(f.client as never);
    f.insert.mockResolvedValueOnce({ error: { code: '23505' } });
    expect(await repo.insertOutfit(outfitRow())).toBe('conflict');
    f.insert.mockResolvedValueOnce({ error: { code: '42501', message: 'denied' } });
    await expect(repo.insertOutfit(outfitRow())).rejects.toMatchObject({ code: '42501' });
  });

  it('reads and writes unavailable_until with the item row', async () => {
    const row = {
      id: 'i1', user_id: 'u', category: 'top', color_hex: '#000000', color_family: 'black', warmth: 2,
      formality: 'casual', image_path: 'i', original_path: 'o', archived_at: null, unavailable_until: '2026-10-15',
    } as const;
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const is = jest.fn().mockResolvedValue({ data: [row], error: null });
    const select = jest.fn(() => ({ is }));
    const f = fakeClient({ from: jest.fn(() => ({ upsert, select })) });
    const repo = new SupabaseRepo(f.client as never);
    await repo.saveItem(row);
    expect(upsert.mock.calls[0][0]).toMatchObject({ unavailable_until: '2026-10-15' });
    expect((await repo.listItems())[0].unavailable_until).toBe('2026-10-15');
  });

  it('never sends pushed_at on insert', async () => {
    const f = fakeClient();
    const repo = new SupabaseRepo(f.client as never);
    expect(await repo.insertOutfit(outfitRow())).toBe('inserted');
    expect(f.insert.mock.calls[0][0]).not.toHaveProperty('pushed_at');
  });

  it('only touches rows that are not worn when the patch has no status', async () => {
    const filters: unknown[][] = [];
    interface Chain {
      eq: (...a: unknown[]) => Chain;
      neq: (...a: unknown[]) => Chain;
      then: (resolve: (v: { error: null }) => unknown) => unknown;
    }
    const chain: Chain = {
      eq: (...a) => (filters.push(['eq', ...a]), chain),
      neq: (...a) => (filters.push(['neq', ...a]), chain),
      then: (resolve) => resolve({ error: null }),
    };
    const update = jest.fn(() => chain);
    const f = fakeClient({
      from: jest.fn(() => ({ update })),
      auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'u' } } }, error: null })) },
    });
    const repo = new SupabaseRepo(f.client as never);
    await repo.updateOutfit('2026-10-12', { item_ids: ['a'], seed: 2 });
    expect(filters).toEqual([
      ['eq', 'user_id', 'u'],
      ['eq', 'date', '2026-10-12'],
      ['neq', 'status', 'worn'],
    ]);
    filters.length = 0;
    await repo.updateOutfit('2026-10-12', { status: 'worn' });
    expect(filters).toEqual([
      ['eq', 'user_id', 'u'],
      ['eq', 'date', '2026-10-12'],
    ]);
  });

  it('caches signed urls until 5 minutes before expiry', async () => {
    const f = fakeClient();
    let now = 1_000_000;
    const repo = new SupabaseRepo(f.client as never, () => now);
    const first = await repo.imageUrl('p');
    now += 3600_000 - 5 * 60_000 - 1;
    expect(await repo.imageUrl('p')).toBe(first);
    expect(f.createSignedUrl).toHaveBeenCalledTimes(1);
    now += 2;
    await repo.imageUrl('p');
    expect(f.createSignedUrl).toHaveBeenCalledTimes(2);
    expect(f.createSignedUrl).toHaveBeenCalledWith('p', 3600);
  });

  it('deleteAccount invokes the function then signs out', async () => {
    const f = fakeClient();
    await new SupabaseRepo(f.client as never).deleteAccount();
    expect(f.client.functions.invoke).toHaveBeenCalledWith('delete-account');
    expect(f.calls).toEqual(['invoke', 'signOut']);
  });

  it('does not throw when signOut fails after deletion', async () => {
    const f = fakeClient();
    f.client.auth.signOut = jest.fn(async () => ({ error: { message: 'x' } })) as never;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(new SupabaseRepo(f.client as never).deleteAccount()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('claimPushToken calls the rpc', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const f = fakeClient({ rpc });
    await new SupabaseRepo(f.client as never).claimPushToken(null);
    expect(rpc).toHaveBeenCalledWith('claim_push_token', { token: null });
  });
});
